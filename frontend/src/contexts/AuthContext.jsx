import React, { createContext, useContext, useReducer, useEffect } from 'react';

const AuthContext = createContext(null);

const AUTH_ACTIONS = {
    LOGIN_START: 'LOGIN_START',
    LOGIN_SUCCESS: 'LOGIN_SUCCESS',
    LOGIN_FAILURE: 'LOGIN_FAILURE',
    LOGOUT: 'LOGOUT',
    SET_USER: 'SET_USER',
    SET_LOADING: 'SET_LOADING'
};

const initialState = {
    user: null,
    inAuthenticated: false,
    isLoading: true,
    error: null
};

function authReducer(state, action) {
    switch (action.type) {
        case AUTH_ACTIONS.LOGIN_START:
            return {
                ...state,
                isLoading: true,
                error: null
            };
        
        case AUTH_ACTIONS.LOGIN_SUCCESS:
            return {
                ...state,
                isAuthenticated: true,
                isLoading: false,
                user: action.payload.user,
                error: null
            };

        case AUTH_ACTIONS.LOGIN_FAILURE:
            return {
                ...state,
                isAuthenticated: false,
                isLoading: false,
                user: null,
                error: action.payload.error
            };
        
        case AUTH_ACTIONS.LOGOUT:
            return {
                ...initialState,
                isLoading: false,
            }
        
        case AUTH_ACTIONS.SET_LOADING:
            console.log(state)
            return {
                ...state,
                isLoading: action.payload.isLoading
            };
        
        default:
            return state;
    }
}

export function AuthProvider({ children }) {
    const [state, dispatch] = useReducer(authReducer, initialState);

    useEffect(() => {
        checkExistingAuth();
    }, []);

    async function checkExistingAuth() {
        try {
            const response = await fetch('/api/v1/auth/me/', {
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            console.log("response: ", response);
            console.log("response.ok", response.ok);
            console.log("response.json", response.json);
            if (response.ok) {
                const userData = await response.json();
                console.log("userData: ", userData);
                dispatch({
                    type: AUTH_ACTIONS.LOGIN_SUCCESS,
                    payload: { user: userData }
                });
            } else if (response.status === 401) {
                dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: { isLoading: false } });
            } else {
                console.error('Auth check failed:', response.status);
                dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: { isloading: false } });
            }
        } catch (error) {
            console.log("error:\n", error, "\n")
            console.error('Error checking authentication:', error);
            dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: { isLoading: false} });
        }
    }

    function login() {
        dispatch({ type: AUTH_ACTIONS.LOGIN_START });
        window.location.href = '/api/v1/auth/oauth';
    }

    async function completeLogin() {
        try {
            const response = await fetch('/api/v1/auth/me/', {
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const userData = await response.json();
                dispatch({
                    type: AUTH_ACTIONS.LOGIN_SUCCESS,
                    payload: { user: userData }
                });
                return true;
            } else {
                throw new Error('Failed to fetch user data');
            }
        } catch (error) {
            console.error('Login completion error:', error);
            dispatch({
                type: AUTH_ACTIONS.LOGIN_FAILURE,
                payload: { error: 'Authentication failed. Please try again' }
            });
            return false;
        }
    }

    async function logout() {
        try {
            await fetch('/api/v1/auth/logout/', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            dispatch({ type: AUTH_ACTIONS.LOGOUT });
        }
    }

    const value = {
        ...state,
        login,
        logout,
        completeLogin
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);

    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }

    return context;
}