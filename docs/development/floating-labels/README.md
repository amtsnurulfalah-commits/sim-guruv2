# Floating label UI

Text, search, email, telephone, password, numeric and multiline fields now share
`ui-floating-field` / `ui-floating-label` presentation across the application.
The reusable account and activity Field components cover dynamically rendered
journal, attendance, duty and examination inputs. Page-specific search/filter
and editor controls use the same classes. The sidebar search has a visible label.

CSS uses native `:placeholder-shown`, `:focus-within` and `:autofill`; no JS state,
value copying, DOM mutation, extra event listener or form submission change is
introduced. A blank placeholder provides empty-state detection; existing useful
placeholders are preserved and their labels remain raised. Native date/time
controls also keep raised labels. Password visibility continues to use the same
input and the existing reset listener. Input names, IDs, values, types, constraints,
handlers, validation descriptions and API payloads remain unchanged.

Labels occupy their own layout row, allowing wrapping on small screens instead
of clipping long labels or overlapping entered values. Inputs retain at least
44px touch height and 16px text. Focus, error, disabled, print and reduced-motion
states are covered. Checkboxes, radio buttons, file/hidden inputs and selects do
not receive the textbox border/animation. Older browsers without :has retain
readable ordinary labels and existing input styling.

Validation: lint, TypeScript, production build, 179 unit tests; focused floating
label browser checks plus existing login/user/account/journal/schedule suites.
The login test trusts only its disposable browser TLS proxy via a browser launch
flag so the new PWA worker can load its self-signed test script; production TLS
configuration is unchanged. Browser
fixtures are disposable and contain synthetic data only. Physical device UAT is
not implied. No database migration, environment variable or dependency change.
