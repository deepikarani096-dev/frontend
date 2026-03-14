import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface User {
  id?: number;
  username: string;
  facultyId?: string;
  facultyName?: string;
  scopusId?: string;
  accessLevel: number; // 1 = Admin, 2 = HoD (department-filtered), 3 = Faculty (restricted - own only)
  email?: string;
  isAdmin?: boolean;
  department?: string; // NEW: Department field for HoD-level filtering
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  hasAccess: (requiredLevels: number[]) => boolean;
  isAdmin: () => boolean;
  isFaculty: () => boolean;
  isRestrictedFaculty: () => boolean;
  isHoD: () => boolean; // NEW: Check if user is HoD (level 2)
  canAccessFacultyData: (facultyId: string) => boolean;
  getAuthHeaders: () => Record<string, string>; // NEW: Helper to get headers for API calls
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Load user from localStorage on mount
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (error) {
        console.error('Failed to parse stored user:', error);
        localStorage.removeItem('user');
      }
    }
    setLoading(false);
  }, []);

  const login = async (username: string, password: string) => {
    try {
      const response = await fetch('https://srm-sp-production.up.railway.app/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Login failed');
      }

      // Store user in state and localStorage
      localStorage.setItem('user', JSON.stringify(data.user));
      setUser(data.user);
    } catch (error) {
      throw error;
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
    // Clear persisted filter state so the next user starts fresh
    try { sessionStorage.removeItem("facultyListFilters_v2"); } catch { /* ignore */ }
    try { localStorage.removeItem("facultyListFilters_v2"); } catch { /* ignore */ }
  };

  // Check if user has access level
  const hasAccess = (requiredLevels: number[]): boolean => {
    if (!user) return false;
    return requiredLevels.includes(user.accessLevel);
  };

  // Check if user is admin (access_level = 1)
  const isAdmin = (): boolean => {
    return user?.accessLevel === 1 || false;
  };

  // Check if user is faculty (access_level = 2 or 3)
  const isFaculty = (): boolean => {
    return (user?.accessLevel === 2 || user?.accessLevel === 3) || false;
  };

  // Check if user is restricted faculty (access_level = 3)
  const isRestrictedFaculty = (): boolean => {
    return user?.accessLevel === 3 || false;
  };

  // Check if user is HoD (access_level = 2)
  const isHoD = (): boolean => {
    return user?.accessLevel === 2 || false;
  };

  // Check if user can access specific faculty data
  // Admins can access any faculty
  // HoDs (level 2) can access only faculty in their department
  // Restricted faculty (3) can only access their own
  const canAccessFacultyData = (facultyId: string): boolean => {
    if (!user) return false;
    
    // Admin (1) can access all
    if (user.accessLevel === 1) return true;
    
    // HoD (2) can access all faculty in their department (backend enforces this)
    if (user.accessLevel === 2) return true;
    
    // Restricted faculty (3) can only access own
    if (user.accessLevel === 3) {
      return user.facultyId === facultyId;
    }
    
    return false;
  };

  // Helper: Get HTTP headers with user info for API calls
  const getAuthHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = {};
    if (!user) return headers;

    headers['user-id'] = user.id?.toString() || '';
    headers['access-level'] = user.accessLevel.toString();
    headers['username'] = user.username || '';
    
    if (user.facultyId) {
      headers['faculty-id'] = user.facultyId;
    }
    if (user.department) {
      headers['department'] = user.department;
    }
    if (user.scopusId) {
      headers['scopus-id'] = user.scopusId;
    }
    
    return headers;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        loading,
        login,
        logout,
        hasAccess,
        isAdmin,
        isFaculty,
        isRestrictedFaculty,
        isHoD,
        canAccessFacultyData,
        getAuthHeaders,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// Hook to use auth context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
