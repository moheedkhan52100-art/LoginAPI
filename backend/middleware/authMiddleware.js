const protect = (req, res, next) => {

    if (req.session && req.session.userId) {

        return next();

    }

    return res.status(401).json({
        message: "Unauthorized. Please login."
    });

};

module.exports = protect;