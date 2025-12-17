import jwt from 'jsonwebtoken';
import User from '../models/User.js';

/**
 * Authentication middleware - Verify JWT token
 * Protects routes from unauthorized access
 */
export const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      // decoded now expected shape { id: <userId>, iat, exp }
      req.user = await User.findById(decoded.id).select('-password');
      if (!req.user) {
        console.warn('[AUTH][protect] User not found for decoded id', decoded.id, 'path:', req.path);
      } else {
        if (process.env.NODE_ENV !== 'production') {
          console.log('[AUTH][protect] OK user', req.user._id.toString(), 'path:', req.method, req.originalUrl);
        }
      }

      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'User not found'
        });
      }

      next();
    } catch (error) {
  console.error('[AUTH][protect] Token verification error:', error.message, 'path:', req.method, req.originalUrl);
      return res.status(401).json({
        success: false,
        message: 'Not authorized, token failed'
      });
    }
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized, no token'
    });
  }
};

// Grant access to specific roles
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `User role ${req.user.role} is not authorized to access this route`
      });
    }
    next();
  };
};
