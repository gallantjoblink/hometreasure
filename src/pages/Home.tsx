import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { ScrollArea } from '../components/ui/scroll-area';
import { Bell } from 'lucide-react';
import { useAuth } from '../components/AuthProvider';
import { useLanguage } from '../contexts/LanguageContext';

export default function Home() {
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const { user } = useAuth();
  const { t } = useLanguage();

  useEffect(() => {
    if (!user) {
      setProducts([]);
      return;
    }
    const q = query(collection(db, 'products'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const prods = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProducts(prods);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'products'));

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    const q = query(collection(db, 'categories'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'categories'));
    return () => unsubscribe();
  }, []);

  const getCategoryName = (id: string) => {
    return categories.find(c => c.id === id)?.name || id;
  };

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }
    const q = query(collection(db, 'transactionNotifications'), orderBy('createdAt', 'desc'), limit(10));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setNotifications(notifs);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'transactionNotifications'));

    return () => unsubscribe();
  }, [user]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
      <div className="lg:col-span-3">
        <h1 className="text-3xl font-bold mb-6">{t('home.latestProducts')}</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {products.map(product => (
            <Link key={product.id} to={`/product/${product.id}`}>
              <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer overflow-hidden group">
                <div className="aspect-square bg-slate-100 relative">
                  {product.images && product.images.length > 0 ? (
                    <img src={product.images[0]} alt={product.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400">No Image</div>
                  )}
                  <Badge className="absolute top-2 right-2" variant={product.status === 'available' ? 'default' : 'secondary'}>
                    {t(`status.${product.status}` as any) || product.status}
                  </Badge>
                </div>
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-lg line-clamp-1">{product.title}</CardTitle>
                  <p className="text-sm text-slate-500">{getCategoryName(product.category)}</p>
                </CardHeader>
                <CardFooter className="p-4 pt-0">
                  <p className="font-semibold text-lg">₩{product.price.toLocaleString()}</p>
                </CardFooter>
              </Card>
            </Link>
          ))}
          {products.length === 0 && (
            <div className="col-span-full py-12 text-center text-slate-500">
              {!user ? t('home.loginToViewProducts') : t('home.noProducts')}
            </div>
          )}
        </div>
      </div>
      
      <div className="lg:col-span-1">
        <Card className="sticky top-24">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-lg flex items-center gap-2">
              <Bell className="h-5 w-5 text-amber-500" />
              {t('home.recentTransactions')}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[400px]">
              <div className="p-4 flex flex-col gap-4">
                {notifications.map(notif => (
                  <div key={notif.id} className="text-sm border-l-2 border-amber-500 pl-3 py-1">
                    <p className="font-medium text-slate-900">{notif.productTitle}</p>
                    <p className="text-slate-500 text-xs mt-1">{notif.message}</p>
                    <p className="text-slate-400 text-[10px] mt-1">
                      {notif.createdAt?.toDate ? notif.createdAt.toDate().toLocaleDateString() : ''}
                    </p>
                  </div>
                ))}
                {notifications.length === 0 && (
                  <p className="text-sm text-slate-500 text-center py-4">
                    {!user ? t('home.loginToViewTransactions') : t('home.noTransactions')}
                  </p>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
