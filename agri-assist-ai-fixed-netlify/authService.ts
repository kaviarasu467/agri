
import { 
    createUserWithEmailAndPassword, 
    updateProfile,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged as firebaseOnAuthStateChanged,
    sendPasswordResetEmail,
    signInWithPhoneNumber as firebaseSignInWithPhoneNumber,
    RecaptchaVerifier,
    type ConfirmationResult as FirebaseConfirmationResult,
    type ApplicationVerifier,
    type User as FirebaseUser
} from 'firebase/auth';
import { auth } from './firebase';
import { User } from '../types';

// Re-export for use in components, keeping the names consistent
export { RecaptchaVerifier };
export type ConfirmationResult = FirebaseConfirmationResult;


export const signInWithPhoneNumber = (
    phoneNumber: string,
    verifier: ApplicationVerifier
): Promise<FirebaseConfirmationResult> => {
    return firebaseSignInWithPhoneNumber(auth, phoneNumber, verifier);
};

export const signup = async (displayName: string, email: string, password: string): Promise<User> => {
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName });
        return { displayName, email };
    } catch (error: any) {
        console.error("Firebase signup error:", error);
        switch (error.code) {
            case 'auth/email-already-in-use':
                throw new Error('auth.error.emailInUse');
            case 'auth/invalid-email':
                throw new Error('auth.error.invalidEmail');
            case 'auth/weak-password':
                throw new Error('auth.error.weakPassword');
            case 'auth/operation-not-allowed':
                throw new Error('auth.error.operationNotAllowed');
            case 'auth/network-request-failed':
                throw new Error('auth.error.networkFailed');
            default:
                throw new Error(`auth.error.defaultSignup,{code:${error.code || error.message}}`);
        }
    }
};

export const login = async (email: string, password: string): Promise<User> => {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        return { 
            displayName: user.displayName || 'Farmer', 
            email: user.email || '' 
        };
    } catch (error: any) {
         console.error("Firebase login error:", error);
         switch (error.code) {
            case 'auth/user-not-found':
            case 'auth/wrong-password':
            case 'auth/invalid-credential':
                throw new Error('auth.error.invalidCredential');
            case 'auth/operation-not-allowed':
                throw new Error('auth.error.operationNotAllowed');
            case 'auth/network-request-failed':
                throw new Error('auth.error.networkFailed');
            default:
                throw new Error(`auth.error.defaultLogin,{code:${error.code || error.message}}`);
         }
    }
};

export const logout = (): Promise<void> => {
    return signOut(auth);
};

export const onAuthStateChanged = (callback: (user: User | null) => void) => {
    return firebaseOnAuthStateChanged(auth, (user: FirebaseUser | null) => {
        if (user) {
            callback({
                displayName: user.displayName || 'Farmer',
                email: user.email || user.phoneNumber || ''
            });
        } else {
            callback(null);
        }
    });
};

export const resetPassword = (email: string): Promise<void> => {
     try {
        return sendPasswordResetEmail(auth, email);
    } catch (error: any) {
        switch (error.code) {
            case 'auth/user-not-found':
                throw new Error('auth.error.userNotFound');
            default:
                throw new Error(`auth.error.defaultReset,{code:${error.code || error.message}}`);
        }
    }
};
