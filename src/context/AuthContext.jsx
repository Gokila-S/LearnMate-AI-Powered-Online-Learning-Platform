import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext();

// Auth reducer
const authReducer = (state, action) => {
  switch (action.type) {
    case 'LOGIN':
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
        isAuthenticated: true,
        loading: false,
        error: null
      };
    case 'LOGOUT':
      return {
        ...state,
        user: null,
        token: null,
        isAuthenticated: false,
        loading: false,
        error: null
      };
    case 'UPDATE_USER':
      return {
        ...state,
        user: { ...state.user, ...action.payload },
        loading: false,
        error: null
      };
    case 'SET_LOADING':
      return {
        ...state,
        loading: action.payload
      };
    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
        loading: false
      };
    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null
      };
    default:
      return state;
  }
};

// Initial state
const initialState = {
  user: null,
  token: null,
  isAuthenticated: false,
  loading: true,
  error: null
};

// AuthProvider component
export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Initialize auth state - optimized for faster loading
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const token = localStorage.getItem('token');
        const userStr = localStorage.getItem('user');

        if (token && userStr) {
          // Immediately use cached user data for faster loading
          try {
            const cachedUser = JSON.parse(userStr);
            dispatch({
              type: 'LOGIN',
              payload: {
                user: cachedUser,
                token
              }
            });

            // Verify token in background (non-blocking)
            authAPI.getUser().then(userData => {
              // Update with fresh data if different
              if (JSON.stringify(userData) !== userStr) {
                localStorage.setItem('user', JSON.stringify(userData));
                dispatch({
                  type: 'UPDATE_USER',
                  payload: userData
                });
              }
            }).catch(() => {
              // Token is invalid, clear storage and logout
              localStorage.removeItem('token');
              localStorage.removeItem('user');
              dispatch({ type: 'LOGOUT' });
            });
          } catch (parseError) {
            // Invalid cached user, verify with API
            try {
              const userData = await authAPI.getUser();
              localStorage.setItem('user', JSON.stringify(userData));
              dispatch({
                type: 'LOGIN',
                payload: { user: userData, token }
              });
            } catch (error) {
              localStorage.removeItem('token');
              localStorage.removeItem('user');
              dispatch({ type: 'SET_LOADING', payload: false });
            }
          }
        } else {
          dispatch({ type: 'SET_LOADING', payload: false });
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    };

    initializeAuth();
  }, []);

  // Login function
  const login = async (credentials) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });

      const response = await authAPI.login(credentials);

      localStorage.setItem('token', response.token);
      localStorage.setItem('user', JSON.stringify(response.user));

      dispatch({
        type: 'LOGIN',
        payload: {
          user: response.user,
          token: response.token
        }
      });

      return { success: true };
    } catch (error) {
      const errorMessage = error.response?.data?.msg || error.message || 'Login failed';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      return { success: false, error: errorMessage };
    }
  };

  // Register function
  const register = async (userData) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });

      const response = await authAPI.register(userData);

      localStorage.setItem('token', response.token);
      localStorage.setItem('user', JSON.stringify(response.user));

      dispatch({
        type: 'LOGIN',
        payload: {
          user: response.user,
          token: response.token
        }
      });

      return { success: true };
    } catch (error) {
      const errorMessage = error.response?.data?.msg ||
        error.response?.data?.errors?.[0]?.msg ||
        error.message ||
        'Registration failed';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      return { success: false, error: errorMessage };
    }
  };

  // Logout function
  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    dispatch({ type: 'LOGOUT' });
  };

  // Update user profile
  const updateUser = async (userData) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });

      const updatedUser = await authAPI.updateUser(userData);
      localStorage.setItem('user', JSON.stringify(updatedUser));

      dispatch({ type: 'UPDATE_USER', payload: updatedUser });
      return { success: true };
    } catch (error) {
      const errorMessage = error.response?.data?.msg || error.message || 'Update failed';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      return { success: false, error: errorMessage };
    }
  };

  // Clear error
  const clearError = () => {
    dispatch({ type: 'CLEAR_ERROR' });
  };

  const value = {
    ...state,
    login,
    register,
    logout,
    updateUser,
    clearError
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
