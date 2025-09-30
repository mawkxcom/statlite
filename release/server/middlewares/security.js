export function securityHeaders() {
    return (_req, res, next) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Referrer-Policy', 'no-referrer-when-downgrade');
        res.setHeader('X-Frame-Options', 'SAMEORIGIN');
        res.setHeader('Permissions-Policy', 'geolocation=(), microphone=()');
        next();
    };
}
