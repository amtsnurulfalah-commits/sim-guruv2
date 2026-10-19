export type SessionDto = {
    user: {
        id: string;
        username: string;
        fullName: string;
        role: "admin" | "guru";
    };
    scope: "onboarding" | "business";
    expiresAt: string;
    idleExpiresAt: string;
    onboarding: {
        mustChangePassword: boolean;
        emailVerified: boolean;
        securityQuestionReady: boolean;
    };
    maintenance: boolean;
};
