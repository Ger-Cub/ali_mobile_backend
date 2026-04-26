const { Strategy, ExtractJwt } = require('passport-jwt');
const prisma = require('./db');

const options = {
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: process.env.JWT_SECRET,
};

module.exports = (passport) => {
    passport.use(
        new Strategy(options, async (jwt_payload, done) => {
            try {
                const admin = await prisma.admin.findUnique({
                    where: { id: jwt_payload.id },
                });

                if (admin) {
                    return done(null, admin);
                }
                return done(null, false);
            } catch (error) {
                return done(error, false);
            }
        })
    );
};
