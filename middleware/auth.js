const authMiddleware = (req, res, next) => {
    if (!req.session.companyId) {
        return res.redirect('/auth/login');
    }
    next();
};

module.exports = authMiddleware;
