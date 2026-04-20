import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../components/AuthProvider';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { Card, CardContent } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import { useLanguage } from '../contexts/LanguageContext';

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<any>(null);
  const [categoryName, setCategoryName] = useState<string>('');
  const [existingQuote, setExistingQuote] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string>('');
  const { user, profile } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchProduct = async () => {
      if (!id || !user) {
        setLoading(false);
        return;
      }
      try {
        const docRef = doc(db, 'products', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const prodData = { id: docSnap.id, ...docSnap.data() } as any;
          setProduct(prodData);
          if (prodData.images && prodData.images.length > 0) {
            setSelectedImage(prodData.images[0]);
          }
          
          // Fetch category name
          if (prodData.category) {
            const catSnap = await getDoc(doc(db, 'categories', prodData.category));
            if (catSnap.exists()) {
              setCategoryName((catSnap.data() as any).name);
            } else {
              setCategoryName(prodData.category); // Fallback to ID if not found
            }
          }

          // Check for existing quote
          const q = query(collection(db, 'quoteRequests'), where('productId', '==', id));
          const quoteSnap = await getDocs(q);
          if (!quoteSnap.empty) {
            setExistingQuote({ id: quoteSnap.docs[0].id, ...quoteSnap.docs[0].data() });
          }
        } else {
          toast.error(t('product.notFound'));
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `products/${id}`);
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
  }, [id, user]);

  const [quotePrice, setQuotePrice] = useState('');

  const handleSendQuote = async () => {
    if (!user || !profile) return;
    if (!quotePrice || isNaN(Number(quotePrice))) {
      toast.error("Please enter a valid price");
      return;
    }

    setSubmitting(true);
    try {
      await addDoc(collection(db, 'quoteRequests'), {
        productId: product.id,
        adminId: user.uid,
        sellerId: product.sellerId,
        message: message,
        status: 'quoted',
        quotePrice: Number(quotePrice),
        iteration: 1,
        createdAt: serverTimestamp()
      });
      toast.success("Quote sent successfully!");
      setMessage('');
      setQuotePrice('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'quoteRequests');
      toast.error("Failed to send quote");
    } finally {
      setSubmitting(false);
    }
  };

  const isImageString = (val: any) => {
    if (typeof val !== 'string') return false;
    return val.startsWith('http') || val.startsWith('data:image/');
  };

  const allImages = React.useMemo(() => {
    if (!product) return [];
    const images = [...(product.images || [])];
    if (product.specs) {
      Object.values(product.specs).forEach(val => {
        if (isImageString(val)) {
          if (!images.includes(val as string)) images.push(val as string);
        }
      });
    }
    return images;
  }, [product]);

  if (loading) return <div className="py-12 text-center">Loading...</div>;
  if (!user) return <div className="py-12 text-center">{t('product.loginToView')}</div>;
  if (!product) return <div className="py-12 text-center">{t('product.notFound')}</div>;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <div className="aspect-square bg-slate-100 rounded-xl overflow-hidden mb-4 border shadow-sm">
            {selectedImage ? (
              <img src={selectedImage} alt={product.title} className="w-full h-full object-cover transition-all duration-300" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-400">No Image</div>
            )}
          </div>
          {allImages.length > 1 && (
            <div className="grid grid-cols-5 gap-2">
              {allImages.map((img: string, idx: number) => (
                <button 
                  key={idx} 
                  onClick={() => setSelectedImage(img)}
                  className={`aspect-square bg-slate-100 rounded-md overflow-hidden border-2 transition-all ${selectedImage === img ? 'border-primary shadow-md scale-95' : 'border-transparent hover:border-slate-300'}`}
                >
                  <img src={img} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                </button>
              ))}
            </div>
          )}
        </div>
        
        <div className="flex flex-col">
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <Badge>{categoryName}</Badge>
              <Badge variant={product.status === 'available' ? 'outline' : 'secondary'}>
                {t(`status.${product.status}` as any) || product.status}
              </Badge>
            </div>
            <h1 className="text-3xl font-bold mb-2">{product.title}</h1>
            <p className="text-2xl font-semibold text-primary mb-4">₩{product.price.toLocaleString()}</p>
            <div className="prose prose-slate max-w-none">
              <p className="whitespace-pre-wrap text-slate-600">{product.description}</p>
            </div>
          </div>

          {product.specs && Object.keys(product.specs).length > 0 && (
            <div className="mb-8">
              <h3 className="font-semibold text-lg mb-3">{t('product.specs')}</h3>
              <Card>
                <CardContent className="p-0">
                  <dl className="divide-y divide-slate-100">
                    {Object.entries(product.specs).map(([key, value]) => (
                      <div key={key} className="px-4 py-3 sm:grid sm:grid-cols-3 sm:gap-4">
                        <dt className="text-sm font-medium text-slate-500 capitalize">{key}</dt>
                        <dd className="mt-1 text-sm text-slate-900 sm:mt-0 sm:col-span-2">
                          {isImageString(value) ? (
                            <div className="flex flex-col gap-2">
                              <img src={value as string} alt={key} className="max-h-32 rounded border cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setSelectedImage(value as string)} referrerPolicy="no-referrer" />
                              <span className="text-[10px] text-slate-400 italic">(Click to view in main gallery)</span>
                            </div>
                          ) : (
                            String(value)
                          )}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </CardContent>
              </Card>
            </div>
          )}

          <div className="mt-auto pt-8 border-t">
            <h3 className="font-semibold text-lg mb-3">{t('product.adminQuote')}</h3>
            {product.status !== 'available' ? (
              <div className="bg-slate-100 p-4 rounded-lg text-center text-slate-500">
                {t('product.statusMsg', { status: t(`status.${product.status}` as any) || product.status })}
              </div>
            ) : existingQuote ? (
              <div className="bg-blue-50 p-4 rounded-lg text-center text-blue-800">
                <p className="font-semibold mb-2">A quote has already been initiated for this product.</p>
                <p className="text-sm mb-4">Current Status: {(existingQuote.status === 'do_not_buy' && profile?.role !== 'admin') ? t('status.rejected') : (t(`status.${existingQuote.status}` as any, { iteration: existingQuote.iteration || 1 }) || existingQuote.status)}</p>
                <Button onClick={() => navigate(profile?.role === 'admin' ? '/admin' : '/seller')} variant="outline">
                  Go to Dashboard to Manage
                </Button>
              </div>
            ) : profile?.role === 'admin' ? (
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="flex-1 space-y-2">
                    <Label>{t('product.quotePrice')}</Label>
                    <Input type="number" value={quotePrice} onChange={e => setQuotePrice(e.target.value)} placeholder="e.g. 50000" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{t('product.messageToSeller')}</Label>
                  <Textarea 
                    placeholder="Explain your quote..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={3}
                  />
                </div>
                <Button 
                  className="w-full" 
                  size="lg" 
                  onClick={handleSendQuote}
                  disabled={submitting}
                >
                  {t('product.sendQuote')}
                </Button>
              </div>
            ) : (
              <div className="bg-slate-50 p-4 rounded-lg text-center text-slate-600">
                {t('product.waitingAdmin')}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
