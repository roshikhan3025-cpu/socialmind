import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { authGetNonce, authWalletLogin, authGetMe, authGoogleLogin } from "../utils/api";
import { connectMetaMask, signMessage, onAccountsChanged } from "../lib/metamask";

interface User {
  id: string;
  email: string;
  name: string;
  image?: string;
  walletAddress?: string;
  createdAt: number;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  connectWallet: () => Promise<void>;
  logout: () => void;
  error: string | null;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);
const TOKEN_KEY = "socialmind-token";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check for existing session
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      authGetMe()
        .then((data) => setUser(data.user))
        .catch(() => localStorage.removeItem(TOKEN_KEY))
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  // Listen for MetaMask account switches — logout if account changes
  useEffect(() => {
    const unsub = onAccountsChanged((accounts) => {
      if (accounts.length === 0 || (user?.walletAddress && accounts[0]?.toLowerCase() !== user.walletAddress)) {
        localStorage.removeItem(TOKEN_KEY);
        setUser(null);
      }
    });
    return unsub;
  }, [user?.walletAddress]);

  const connectWallet = useCallback(async () => {
    setError(null);
    try {
      // 1. Connect MetaMask + switch to Base
      const address = await connectMetaMask();

      // 2. Get a nonce from our backend
      const { nonce } = await authGetNonce();

      // 3. Build the sign-in message
      const message = [
        "Sign in to SocialMind",
        "",
        `Wallet: ${address}`,
        `Chain: Base (8453)`,
        `Nonce: ${nonce}`,
        `Issued At: ${new Date().toISOString()}`,
      ].join("\n");

      // 4. Ask MetaMask to sign it
      const signature = await signMessage(address, message);

      // 5. Verify on backend + get JWT
      const data = await authWalletLogin(address, signature, message, nonce);
      localStorage.setItem(TOKEN_KEY, data.token);
      setUser(data.user);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Wallet connection failed";
      // Don't show error if user rejected the request
      if (!msg.includes("rejected") && !msg.includes("denied") && !msg.includes("User rejected")) {
        setError(msg);
      }
      throw err;
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        connectWallet,
        logout,
        error,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
