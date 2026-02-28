/// <reference types="vite/client" />
import { Auth0Client, createAuth0Client, User } from '@auth0/auth0-spa-js';

let auth0: Auth0Client | null = null;
let currentUser: User | undefined;

export const initAuth0 = async () => {
    try {
        const domain = import.meta.env.VITE_AUTH0_DOMAIN;
        const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID;

        console.log("Auth0 Config Check:", { domain, clientId });

        if (!domain || !clientId) {
            alert("Error: Auth0 Configuration Missing. Please check .env file.");
            return false;
        }

        auth0 = await createAuth0Client({
            domain: domain,
            clientId: clientId,
            authorizationParams: {
                redirect_uri: window.location.origin
            },
            cacheLocation: 'localstorage'
        });

        // Handle Redirect
        if (location.search.includes("state=") && (location.search.includes("code=") || location.search.includes("error="))) {
            await auth0.handleRedirectCallback();
            window.history.replaceState({}, document.title, "/");
        }

        const isAuth = await auth0.isAuthenticated();
        if (isAuth) {
            currentUser = await auth0.getUser();
        }
        return isAuth;
    } catch (error) {
        console.error("Auth0 Init Error:", error);
        return false;
    }
};

export const login = async () => {
    if (!auth0) return;
    await auth0.loginWithRedirect();
};

export const logout = async () => {
    try {
        if (auth0) {
            await auth0.logout({
                logoutParams: {
                    returnTo: window.location.origin
                }
            });
        }
    } catch (e) {
        console.error("Auth0 logout error:", e);
    } finally {
        // Fallback or if auth0 null
        window.location.href = '/';
    }
};

export const getUser = () => currentUser;

export const getToken = async () => {
    if (!auth0) return null;
    return await auth0.getTokenSilently();
};
