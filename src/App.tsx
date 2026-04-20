import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from './components/AuthProvider';
import { loginWithGoogle, logout } from './firebase';
import { Button } from './components/ui/button';
import { Toaster } from './components/ui/sonner';
import Home from './pages/Home';
import ProductDetail from './pages/ProductDetail';
import SellerDashboard from './pages/SellerDashboard';
import AdminDashboard from './pages/AdminDashboard';
import { Package2, LogOut, LogIn, Store, ShieldAlert, Globe } from 'lucide-react';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';

const Navigation = () => {
  const { user, profile, loading } = useAuth();
  const { language, setLanguage, t } = useLanguage();

  return (
    <nav className="border-b bg-white/50 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <Link to="/" className="flex items-center gap-2 font-bold text-xl text-primary">
            <Package2 className="h-6 w-6" />
            <span>ReTrade</span>
          </Link>
          
          <div className="flex items-center gap-4">
            {!loading && (
              <>
                {user ? (
                  <>
                    <Link to="/seller">
                      <Button variant="ghost" size="sm" className="gap-2">
                        <Store className="h-4 w-4" />
                        {t('nav.myDashboard')}
                      </Button>
                    </Link>
                    {profile?.role === 'admin' && (
                      <Link to="/admin">
                        <Button variant="ghost" size="sm" className="gap-2 text-slate-700 hover:text-slate-900">
                          <ShieldAlert className="h-4 w-4" />
                          {t('nav.admin')}
                        </Button>
                      </Link>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => setLanguage(language === 'en' ? 'ko' : 'en')} className="gap-2">
                      <Globe className="h-4 w-4" />
                      {language === 'en' ? '한국어' : 'English'}
                    </Button>
                    <Button variant="outline" size="sm" onClick={logout} className="gap-2">
                      <LogOut className="h-4 w-4" />
                      {t('nav.logout')}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="ghost" size="sm" onClick={() => setLanguage(language === 'en' ? 'ko' : 'en')} className="gap-2">
                      <Globe className="h-4 w-4" />
                      {language === 'en' ? '한국어' : 'English'}
                    </Button>
                    <Button onClick={loginWithGoogle} size="sm" className="gap-2">
                      <LogIn className="h-4 w-4" />
                      {t('nav.login')}
                    </Button>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <Router>
          <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
            <Navigation />
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/product/:id" element={<ProductDetail />} />
                <Route path="/seller/*" element={<SellerDashboard />} />
                <Route path="/admin/*" element={<AdminDashboard />} />
              </Routes>
            </main>
            <Toaster />
          </div>
        </Router>
      </AuthProvider>
    </LanguageProvider>
  );
}
