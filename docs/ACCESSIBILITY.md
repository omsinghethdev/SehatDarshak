# Accessibility Guidelines

SehatDarsak is intended for people with varied language, literacy, device, and accessibility needs.

- Offer language selection early and keep language names easy to recognize.
- Use readable typography, plain language, high contrast, and avoid colour as the only status indicator.
- Make every control keyboard reachable with visible focus; use semantic HTML and useful screen-reader labels.
- Keep touch targets large (aim for at least 44 by 44 CSS pixels) and leave space between destructive or urgent controls.
- Support `prefers-reduced-motion`; do not rely on animation for queue changes or directions.
- Present concise, actionable error messages next to affected fields and preserve entered data where safe.
- Keep registration and token tracking short, sequential, and free of unexplained jargon.
- Label waiting times as simulated estimates and assistance as a request to hospital staff, not a medical-emergency guarantee.
- Ensure the SVG map has a text alternative: floor and room information must be available without interpreting graphics alone. The map shows locations only; it does not give routes or directions.
- Never make a QR code the only way to identify a token: always show the token's display number (for example `OPD-001`) as large text beside it, and give the QR image a text alternative. Staff scanning must have a non-camera fallback (choosing the token from the department queue list) and must explain camera-permission and scan failures in plain language.

Test future flows with keyboard-only navigation, zoomed text, screen readers, narrow mobile screens, and at least the selected interface languages.
