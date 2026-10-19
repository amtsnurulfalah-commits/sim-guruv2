SET LOCAL ROLE sim_guru_owner;
-- Dispatch the challenge just queued by the request, never an unrelated older message.
CREATE FUNCTION auth_private.claim_security_otp(p_challenge uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE o ops.notification_outbox%ROWTYPE; payload jsonb; lease uuid:=gen_random_uuid();
BEGIN
 UPDATE ops.notification_outbox SET state='cancelled'
 WHERE id IN(SELECT outbox_id FROM auth_private.outbox_secrets WHERE challenge_id=p_challenge)
 AND state IN('pending','retry_wait','unknown') AND (public_payload->>'expiresAt')::timestamptz<=clock_timestamp();
 DELETE FROM auth_private.outbox_secrets s WHERE s.challenge_id=p_challenge
 AND(s.expires_at<=clock_timestamp() OR EXISTS(SELECT 1 FROM ops.notification_outbox x WHERE x.id=s.outbox_id AND x.state IN('sent','failed','cancelled')));
 SELECT x.* INTO o FROM ops.notification_outbox x
 JOIN auth_private.outbox_secrets s ON s.outbox_id=x.id
 JOIN auth_private.verification_challenges c ON c.id=s.challenge_id
 WHERE c.id=p_challenge AND c.user_id=x.recipient_id AND c.purpose=x.template AND c.target_email=x.recipient_email
 AND c.purpose IN('email_verify','reset_otp') AND c.consumed_at IS NULL AND c.superseded_at IS NULL AND c.expires_at>clock_timestamp() AND s.expires_at>clock_timestamp()
 AND x.state IN('pending','retry_wait') AND x.attempts<5 AND x.next_attempt_at<=clock_timestamp()
 ORDER BY x.created_at FOR UPDATE OF x SKIP LOCKED LIMIT 1;
 IF o.id IS NULL THEN RETURN NULL; END IF;
 UPDATE ops.notification_outbox SET state='sending',attempts=attempts+1,lease_token=lease,lease_until=clock_timestamp()+interval '2 minutes' WHERE id=o.id;
 SELECT jsonb_build_object('challengeId',s.challenge_id,'ciphertextHex',encode(s.ciphertext,'hex'),'nonceHex',encode(s.nonce,'hex'),'tagHex',encode(s.auth_tag,'hex'),'keyVersion',s.encryption_key_version)
 INTO payload FROM auth_private.outbox_secrets s WHERE s.outbox_id=o.id;
 RETURN jsonb_build_object('id',o.id,'lease',lease,'userId',o.recipient_id,'email',o.recipient_email,'template',o.template,'public',o.public_payload,'secret',payload);
END $$;
REVOKE ALL ON FUNCTION auth_private.claim_security_otp(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth_private.claim_security_otp(uuid) TO sim_guru_worker;
RESET ROLE;
