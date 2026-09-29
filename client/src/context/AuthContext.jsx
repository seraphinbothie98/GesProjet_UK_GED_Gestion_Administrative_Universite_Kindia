import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [institution, setInstitution] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadInstitution = async () => {
    try {
      const settings = await api.getInstitutionSettings();
      setInstitution(settings);
    } catch (err) {
      console.error('Failed to load global institution settings:', err);
    }
  };

  useEffect(() => {
    loadInstitution();

    const token = localStorage.getItem('uk_ged_token');
    if (token) {
      api.getMe()
        .then(u => setUser(u))
        .catch(() => {
          localStorage.removeItem('uk_ged_token');
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (identity, password) => {
    const data = await api.login(identity, password);
    localStorage.setItem('uk_ged_token', data.token);
    setUser(data.user);
    await loadInstitution();
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem('uk_ged_token');
    setUser(null);
  };

  const hasPermission = (permCode) => {
    if (!user) return false;
    if (user.role_code === 'ADMINISTRATEUR') return true;
    return user.permissions && user.permissions.includes(permCode);
  };

  const getLogoUrl = (type = 'primary') => {
    const targetPath = type === 'secondary' ? institution?.secondary_logo_path : institution?.logo_path;
    if (!targetPath) return null;
    const version = institution?.updated_at ? new Date(institution.updated_at).getTime() : Date.now();
    return `${targetPath}?v=${version}`;
  };

  const getRectorPhotoUrl = () => {
    const targetPath = institution?.rector_photo_path || '/uploads/logos/rector_portrait.jpg';
    if (!targetPath) return '/rector_portrait.jpg';
    const version = institution?.updated_at ? new Date(institution.updated_at).getTime() : Date.now();
    return `${targetPath}?v=${version}`;
  };

  const getLoginBackgroundUrl = () => {
    const targetPath = institution?.login_background_path || '/uploads/logos/login_bg_default.jpg';
    if (!targetPath) return '/login_bg_default.jpg';
    const version = institution?.updated_at ? new Date(institution.updated_at).getTime() : Date.now();
    return `${targetPath}?v=${version}`;
  };

  const refreshUser = async () => {
    try {
      const u = await api.getMe();
      if (u) setUser(u);
      return u;
    } catch (err) {
      console.error('Failed to refresh user profile:', err);
    }
  };

  const refreshInstitution = async () => {
    await loadInstitution();
  };

  return (
    <AuthContext.Provider value={{
      user,
      setUser,
      refreshUser,
      institution,
      getLogoUrl,
      getRectorPhotoUrl,
      getLoginBackgroundUrl,
      refreshInstitution,
      login,
      logout,
      hasPermission,
      loading
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
