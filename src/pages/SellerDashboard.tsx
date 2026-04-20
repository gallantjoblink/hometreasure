import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useNavigate, useParams } from 'react-router-dom';
import { collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, doc, serverTimestamp, getDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, uploadImage } from '../firebase';
import { useAuth } from '../components/AuthProvider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import { Package, MessageSquare, Plus, Check, X, Send, Truck, History, RotateCcw, LayoutGrid, List } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

const ViewToggle = ({ view, setView }: { view: 'list' | 'card', setView: (v: 'list' | 'card') => void }) => (
  <div className="flex bg-slate-100 p-1 rounded-lg">
    <Button 
      variant={view === 'list' ? 'secondary' : 'ghost'} 
      size="sm" 
      onClick={() => setView('list')}
      className="gap-2"
    >
      <List className="h-4 w-4" /> 리스트 보기
    </Button>
    <Button 
      variant={view === 'card' ? 'secondary' : 'ghost'} 
      size="sm" 
      onClick={() => setView('card')}
      className="gap-2"
    >
      <LayoutGrid className="h-4 w-4" /> 카드 보기
    </Button>
  </div>
);

function Transactions() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<any[]>([]);
  const { t } = useLanguage();
  const [trackingNumber, setTrackingNumber] = useState<Record<string, string>>({});
  const [courier, setCourier] = useState<Record<string, string>>({});
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean,
    txId: string,
    accepted: boolean
  }>({
    isOpen: false,
    txId: '',
    accepted: false
  });

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'transactions'), where('sellerId', '==', user.uid), orderBy('updatedAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'transactions'));
    return () => unsubscribe();
  }, [user]);

  const handleUpdateTracking = async (txId: string) => {
    if (!trackingNumber[txId] || !courier[txId]) return toast.error("Please enter tracking number and courier");
    try {
      await updateDoc(doc(db, 'transactions', txId), {
        status: 'shipped',
        trackingNumber: trackingNumber[txId],
        courier: courier[txId],
        updatedAt: serverTimestamp()
      });
      toast.success("Shipment info updated");
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `transactions/${txId}`);
    }
  };

  const handleAcceptFinalOffer = async (txId: string, accepted: boolean) => {
    try {
      if (accepted) {
        await updateDoc(doc(db, 'transactions', txId), {
          status: 'pending_remittance',
          sellerAccepted: true,
          updatedAt: serverTimestamp()
        });
        toast.success("Offer accepted. Waiting for remittance.");
      } else {
        await updateDoc(doc(db, 'transactions', txId), {
          phase: 'return',
          status: 'return_preparing',
          sellerAccepted: false,
          updatedAt: serverTimestamp()
        });
        toast.success("Offer rejected. Item will be returned.");
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `transactions/${txId}`);
    }
  };

  const renderTxCard = (tx: any) => (
    <Card key={tx.id} className="overflow-hidden">
      <CardHeader className="bg-slate-50 py-3">
        <div className="flex justify-between items-center">
          <div className="flex flex-col">
            <CardTitle className="text-sm font-medium">Transaction ID: {tx.id.slice(0, 8)}...</CardTitle>
            <Link to={`/product/${tx.productId}`} className="text-[10px] text-primary hover:underline">View Product</Link>
          </div>
          <Badge variant="outline">{t(`tx.phase.${tx.phase}` as any) || tx.phase}</Badge>
        </div>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        <div className="flex justify-between items-center">
          <div className="space-y-1">
            <p className="text-xs text-slate-500">{t('tx.status')}</p>
            <p className="font-bold text-primary">{t(`tx.status.${tx.status}` as any) || tx.status}</p>
          </div>
          {tx.finalPrice && (
            <div className="text-right">
              <p className="text-xs text-slate-500">{t('tx.finalPrice')}</p>
              <p className="font-bold text-lg">₩{tx.finalPrice.toLocaleString()}</p>
            </div>
          )}
        </div>

        {/* Phase specific UI */}
        {tx.phase === 'in_progress' && tx.status === 'preparing' && (
          <div className="space-y-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
            <p className="text-sm font-medium text-blue-800">{t('tx.inputTracking')}</p>
            <div className="grid grid-cols-2 gap-2">
              <Input 
                placeholder="Courier (e.g. CJ)" 
                value={courier[tx.id] || ''} 
                onChange={e => setCourier(prev => ({ ...prev, [tx.id]: e.target.value }))}
                className="bg-white"
              />
              <Input 
                placeholder="Tracking #" 
                value={trackingNumber[tx.id] || ''} 
                onChange={e => setTrackingNumber(prev => ({ ...prev, [tx.id]: e.target.value }))}
                className="bg-white"
              />
            </div>
            <Button size="sm" className="w-full" onClick={() => handleUpdateTracking(tx.id)}>{t('tx.submitShipment')}</Button>
          </div>
        )}

        {tx.phase === 'completed' && tx.status === 'final_offer' && (
          <div className="space-y-3 p-3 bg-orange-50 rounded-lg border border-orange-100">
            <p className="text-sm font-medium text-orange-800">{t('tx.decideAcceptance')}</p>
            {tx.adminMessage && <p className="text-xs text-slate-600 italic">"{tx.adminMessage}"</p>}
            {tx.finalOfferImages && tx.finalOfferImages.length > 0 && (
              <div className="mt-4 flex flex-col sm:flex-row gap-2 overflow-x-auto pb-2">
                {tx.finalOfferImages.map((imgUrl: string, idx: number) => (
                  <a key={idx} href={imgUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 flex justify-center">
                    <img 
                      src={imgUrl} 
                      alt={`Final Offer ${idx + 1}`} 
                      className="h-48 w-full sm:h-32 sm:w-32 rounded object-cover border bg-white hover:opacity-80 transition-opacity" 
                      referrerPolicy="no-referrer" 
                    />
                  </a>
                ))}
              </div>
            )}
            {/* Fallback for backward compatibility */}
            {tx.finalOfferImage && !tx.finalOfferImages && (
              <div className="mt-2 text-center">
                <a href={tx.finalOfferImage} target="_blank" rel="noopener noreferrer">
                  <img src={tx.finalOfferImage} alt="Final Offer" className="max-h-48 rounded object-contain mx-auto border bg-white hover:opacity-80 transition-opacity" referrerPolicy="no-referrer" />
                </a>
              </div>
            )}
            <div className="flex gap-2">
              <Button size="sm" className="flex-1 bg-green-600 hover:bg-green-700" onClick={() => setConfirmDialog({ isOpen: true, txId: tx.id, accepted: true })}>수락</Button>
              <Button size="sm" variant="destructive" className="flex-1" onClick={() => setConfirmDialog({ isOpen: true, txId: tx.id, accepted: false })}>거절</Button>
            </div>
          </div>
        )}

        {tx.trackingNumber && (
          <div className="text-xs text-slate-500 pt-2 border-t">
            <p>{tx.courier}: {tx.trackingNumber}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">{t('seller.transactions')}</h2>
      <Tabs defaultValue="in_progress" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="in_progress" className="gap-2">
            <Truck className="h-4 w-4" /> 
            {t('tx.phase.in_progress')}
            {transactions.filter(tx => tx.phase === 'in_progress').length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 min-w-5 flex items-center justify-center p-0 text-[10px]">
                {transactions.filter(tx => tx.phase === 'in_progress').length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="completed" className="gap-2">
            <History className="h-4 w-4" /> 
            {t('tx.phase.completed')}
            {transactions.filter(tx => tx.phase === 'completed').length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 min-w-5 flex items-center justify-center p-0 text-[10px]">
                {transactions.filter(tx => tx.phase === 'completed').length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="return" className="gap-2">
            <RotateCcw className="h-4 w-4" /> 
            {t('tx.phase.return')}
            {transactions.filter(tx => tx.phase === 'return').length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 min-w-5 flex items-center justify-center p-0 text-[10px]">
                {transactions.filter(tx => tx.phase === 'return').length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="in_progress" className="space-y-4 mt-4">
          {transactions.filter(tx => tx.phase === 'in_progress').map(renderTxCard)}
          {transactions.filter(tx => tx.phase === 'in_progress').length === 0 && (
            <div className="py-12 text-center text-slate-500 border-2 border-dashed rounded-lg">No active transactions</div>
          )}
        </TabsContent>
        <TabsContent value="completed" className="space-y-4 mt-4">
          {transactions.filter(tx => tx.phase === 'completed').map(renderTxCard)}
          {transactions.filter(tx => tx.phase === 'completed').length === 0 && (
            <div className="py-12 text-center text-slate-500 border-2 border-dashed rounded-lg">No completed transactions</div>
          )}
        </TabsContent>
        <TabsContent value="return" className="space-y-4 mt-4">
          {transactions.filter(tx => tx.phase === 'return').map(renderTxCard)}
          {transactions.filter(tx => tx.phase === 'return').length === 0 && (
            <div className="py-12 text-center text-slate-500 border-2 border-dashed rounded-lg">No return transactions</div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={confirmDialog.isOpen} onOpenChange={(open) => setConfirmDialog(prev => ({ ...prev, isOpen: open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmDialog.accepted ? "최종 거래 수락" : "최종 견적 거절"}</DialogTitle>
            <DialogDescription className="pt-4 text-slate-900 whitespace-pre-wrap leading-relaxed">
              {confirmDialog.accepted ? (
                "최종 거래를 수락하셨습니다.\n\n영업일 기준 2일안으로 정산 금액을 보내드리겠습니다. 등록된 계좌 상태를 반드시 확인하시기 바랍니다.\n\n계좌의 문제로 송금이 되지 않더라도 별도로 연락드리지 않으니 입금 확인이 되지 않으면 고객센터로 문의 바랍니다.\n\n최종 거래를 승인하시고 이 거래 기록을 보관 및 이용함에 동의 하십니까?"
              ) : (
                "최종 견적을 거절 하셨습니다.\n\n거래를 취소하고, 반품을 요청하시겠습니까?"
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}>취소</Button>
            <Button 
              className={confirmDialog.accepted ? "bg-green-600 hover:bg-green-700" : "bg-destructive hover:bg-destructive/90"}
              onClick={() => {
                handleAcceptFinalOffer(confirmDialog.txId, confirmDialog.accepted);
                setConfirmDialog(prev => ({ ...prev, isOpen: false }));
              }}
            >
              {confirmDialog.accepted ? "동의 및 수락" : "거절 및 반품 요청"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SellerProducts() {
  const { user } = useAuth();
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'card'>('card');
  const { t } = useLanguage();

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'products'), where('sellerId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const prods = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
      // Sort client side since we need composite index for where + orderBy
      prods.sort((a, b) => {
        const timeA = a.createdAt?.toMillis?.() || 0;
        const timeB = b.createdAt?.toMillis?.() || 0;
        return timeB - timeA;
      });
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold">{t('seller.myProducts')}</h2>
        <div className="flex items-center gap-4">
          <ViewToggle view={viewMode} setView={setViewMode} />
          <Link to="/seller/products/new">
            <Button className="gap-2"><Plus className="h-4 w-4" /> {t('seller.addProduct')}</Button>
          </Link>
        </div>
      </div>

      {viewMode === 'card' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map(product => (
            <Card key={product.id} className="group overflow-hidden">
              <Link to={`/product/${product.id}`} className="block">
                <div className="aspect-video bg-slate-100 relative overflow-hidden">
                  {product.images && product.images.length > 0 ? (
                    <img src={product.images[0]} alt={product.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400">No Image</div>
                  )}
                  <Badge className="absolute top-2 right-2" variant={product.status === 'available' ? 'default' : 'secondary'}>
                    {t(`status.${product.status}` as any) || product.status}
                  </Badge>
                </div>
              </Link>
              <CardHeader className="p-4">
                <Link to={`/product/${product.id}`} className="hover:underline">
                  <div className="flex justify-between items-start mb-1">
                    <CardTitle className="text-lg line-clamp-1">{product.title}</CardTitle>
                  </div>
                </Link>
                <Badge variant="outline" className="mb-2">{getCategoryName(product.category)}</Badge>
                <CardDescription>₩{product.price.toLocaleString()}</CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-0 flex gap-2">
                <Link to={`/product/${product.id}`} className="flex-1">
                  <Button variant="outline" className="w-full" size="sm">{t('product.viewDetail' as any) || 'View'}</Button>
                </Link>
                <Link to={`/seller/products/${product.id}/edit`} className="flex-1">
                  <Button variant="secondary" className="w-full" size="sm">{t('seller.edit')}</Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50">
                  <th className="p-3 text-left">제품</th>
                  <th className="p-3 text-left">카테고리</th>
                  <th className="p-3 text-left">가격</th>
                  <th className="p-3 text-left">상태</th>
                  <th className="p-3 text-right">관리</th>
                </tr>
              </thead>
              <tbody>
                {products.map(product => (
                  <tr key={product.id} className="border-b hover:bg-slate-50 transition-colors">
                    <td className="p-3">
                      <Link to={`/product/${product.id}`} className="flex items-center gap-3 group">
                        <div className="w-12 h-12 rounded overflow-hidden bg-slate-100 shrink-0 border">
                          {product.images?.[0] ? (
                            <img src={product.images[0]} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-400">No Img</div>
                          )}
                        </div>
                        <span className="font-medium group-hover:text-primary transition-colors line-clamp-1">{product.title}</span>
                      </Link>
                    </td>
                    <td className="p-3 text-slate-500 text-xs">{getCategoryName(product.category)}</td>
                    <td className="p-3 font-semibold">₩{product.price.toLocaleString()}</td>
                    <td className="p-3">
                      <Badge variant={product.status === 'available' ? 'default' : 'secondary'}>
                        {t(`status.${product.status}` as any) || product.status}
                      </Badge>
                    </td>
                    <td className="p-3 text-right">
                      <Link to={`/seller/products/${product.id}/edit`}>
                        <Button variant="outline" size="sm">Edit</Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {products.length === 0 && (
        <div className="col-span-full py-12 text-center text-slate-500 border-2 border-dashed rounded-lg">
          {t('seller.noProducts')}
        </div>
      )}
    </div>
  );
}

const ItemEditor: React.FC<{
  item: any;
  index: number;
  isPrimary: boolean;
  categories: any[];
  onUpdate: (updates: any) => void;
  onRemove?: () => void;
  t: any;
  key?: React.Key;
}> = ({
  item,
  index,
  isPrimary,
  categories,
  onUpdate,
  onRemove,
  t
}) => {
  const selectedCategory = categories.find((c: any) => c.id === item.tier3Id);

  return (
    <div className="space-y-4 pt-4 border-t relative bg-white p-4 rounded-xl border border-slate-200">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-bold text-lg text-slate-800">{isPrimary ? "품목 1 (대표 품목)" : `추가 품목 ${index}`}</h3>
        {!isPrimary && onRemove && (
          <Button type="button" variant="ghost" size="sm" className="text-red-500 hover:bg-red-50" onClick={onRemove}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>품목명</Label>
            <Input 
              value={item.title || ''} 
              onChange={e => onUpdate({ title: e.target.value })} 
              placeholder={isPrimary ? "대표 품목 이름 (예: 데스크탑 본체)" : `추가 품목 ${index} 이름`} 
              required
            />
          </div>

          <div className="space-y-2">
            <Label>{t('form.category')}</Label>
            <div className="flex flex-col gap-2">
              <Select value={item.tier1Id} onValueChange={v => onUpdate({ tier1Id: v, tier2Id: '', tier3Id: '' })}>
                <SelectTrigger>
                  <SelectValue placeholder="Level 1">
                    {item.tier1Id ? categories.find((c: any) => c.id === item.tier1Id)?.name : undefined}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {categories.filter((c: any) => c.level === 1).map((cat: any) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={item.tier2Id} onValueChange={v => onUpdate({ tier2Id: v, tier3Id: '' })} disabled={!item.tier1Id}>
                <SelectTrigger>
                  <SelectValue placeholder="Level 2">
                    {item.tier2Id ? categories.find((c: any) => c.id === item.tier2Id)?.name : undefined}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {categories.filter((c: any) => c.parentId === item.tier1Id).map((cat: any) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={item.tier3Id} onValueChange={v => onUpdate({ tier3Id: v })} disabled={!item.tier2Id}>
                <SelectTrigger>
                  <SelectValue placeholder="Level 3">
                    {item.tier3Id ? categories.find((c: any) => c.id === item.tier3Id)?.name : undefined}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {categories.filter((c: any) => c.parentId === item.tier2Id).map((cat: any) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`price-${isPrimary ? 'main' : index}`}>{isPrimary ? "희망 가격 (대표가/총액)" : "희망 가격 (선택사항)"}</Label>
            <Input 
              id={`price-${isPrimary ? 'main' : index}`} 
              type="number" 
              required={isPrimary} 
              min="0" 
              value={item.price} 
              onChange={e => onUpdate({ price: e.target.value })} 
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`imageFile-${isPrimary ? 'main' : index}`}>품목 이미지</Label>
            <Input 
              id={`imageFile-${isPrimary ? 'main' : index}`} 
              type="file" 
              accept="image/*" 
              onChange={e => {
                if (e.target.files?.[0]) {
                  const file = e.target.files[0];
                  onUpdate({ imageFile: file, imageUrl: URL.createObjectURL(file) });
                }
              }} 
            />
            {item.imageUrl && (
              <div className="mt-2 w-24 h-24 rounded-md overflow-hidden border">
                <img src={item.imageUrl} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedCategory && selectedCategory.fields && selectedCategory.fields.length > 0 && (
        <div className="p-4 bg-slate-50 rounded-lg space-y-4 border mt-4">
          <h4 className="font-semibold text-slate-700">품목 사양</h4>
          {selectedCategory.fields.map((field: any, idx: number) => (
            <div key={idx} className="space-y-2">
              <Label>{field.name} {field.required && <span className="text-red-500">*</span>}</Label>
              {field.type === 'dropdown' ? (
                <Select 
                  required={field.required} 
                  value={item.specs?.[field.name] || ''} 
                  onValueChange={val => onUpdate({ [`specs.${field.name}`]: val })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="옵션 선택">
                      {item.specs?.[field.name] || undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {field.options?.map((opt: string, i: number) => <SelectItem key={i} value={opt}>{opt}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : field.type === 'text' ? (
                <Input 
                  required={field.required} 
                  value={item.specs?.[field.name] || ''} 
                  onChange={e => onUpdate({ [`specs.${field.name}`]: e.target.value })} 
                />
              ) : (
                <div>
                  <Input 
                    type="file" 
                    accept="image/*" 
                    required={field.required && !item.specs?.[field.name]} 
                    onChange={e => {
                      if (e.target.files?.[0]) {
                        onUpdate({ 
                          [`specFiles.${field.name}`]: e.target.files[0],
                          [`specs.${field.name}`]: URL.createObjectURL(e.target.files[0])
                        });
                      }
                    }} 
                  />
                  {item.specs?.[field.name] && <img src={item.specs[field.name]} alt="preview" className="mt-2 h-20 object-cover rounded border" />}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

function ProductForm({ isEdit = false }: { isEdit?: boolean }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const { t } = useLanguage();
  
  const [productTitle, setProductTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('available');
  const [submitting, setSubmitting] = useState(false);
  const [isMultiItem, setIsMultiItem] = useState(false);

  const [commonImages, setCommonImages] = useState<string[]>([]);
  const [commonImageFiles, setCommonImageFiles] = useState<File[]>([]);

  const [primaryItem, setPrimaryItem] = useState<any>({
    title: '', tier1Id: '', tier2Id: '', tier3Id: '', price: '', specs: {}, specFiles: {}, imageUrl: '', imageFile: null
  });
  const [additionalItems, setAdditionalItems] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'categories'), orderBy('order', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      const qFallback = query(collection(db, 'categories'), orderBy('createdAt', 'desc'));
      onSnapshot(qFallback, (snap) => {
        setCategories(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });
    });
    return () => unsubscribe();
  }, []);

  const resolveTiers = (t3Id: string, cats: any[]) => {
    const t3 = cats.find((c: any) => c.id === t3Id);
    const t2Id = t3?.parentId || '';
    const t2 = cats.find((c: any) => c.id === t2Id);
    const t1Id = t2?.parentId || '';
    return { tier2Id: t2Id, tier1Id: t1Id, tier3Id: t3Id };
  };

  useEffect(() => {
    if (isEdit && id && categories.length > 0) {
      const fetchProduct = async () => {
        try {
          const docSnap = await getDoc(doc(db, 'products', id));
          if (docSnap.exists()) {
            const data = docSnap.data();
            setProductTitle(data.title || '');
            setDescription(data.description || '');
            setStatus(data.status || 'available');
            setIsMultiItem(data.isMultiItem || false);
            setCommonImages(data.images || []);
            
            setPrimaryItem({
              title: data.items?.[0]?.title || data.title || '',
              ...resolveTiers(data.category || '', categories),
              price: data.price?.toString() || '',
              specs: data.specs || {},
              specFiles: {},
              imageUrl: (data.images && data.images.length > 0) ? data.images[0] : '',
              imageFile: null
            });

            if (data.items && data.items.length > 0) {
              setAdditionalItems(data.items.slice(1).map((it: any) => ({
                title: it.title || '',
                ...resolveTiers(it.category || '', categories),
                price: it.price?.toString() || '',
                specs: it.specs || {},
                specFiles: {},
                imageUrl: (it.images && it.images.length > 0) ? it.images[0] : '',
                imageFile: null
              })));
            }
          }
        } catch (error) {
          console.error("Error fetching product:", error);
          toast.error("Failed to load product data");
        }
      };
      fetchProduct();
    }
  }, [isEdit, id, categories.length > 0]);

  const handleUpdatePrimary = (updates: any) => {
    setPrimaryItem((prev: any) => {
      const next = { ...prev };
      Object.entries(updates).forEach(([field, value]) => {
        if (field.startsWith('specs.')) {
          next.specs = { ...(next.specs || {}), [field.split('.')[1]]: value };
        } else if (field.startsWith('specFiles.')) {
          next.specFiles = { ...(next.specFiles || {}), [field.split('.')[1]]: value };
        } else {
          (next as any)[field] = value;
        }
      });
      return next;
    });
  };

  const handleUpdateAdditional = (index: number, updates: any) => {
    setAdditionalItems((prev: any[]) => {
      const newItems = [...prev];
      const next = { ...newItems[index] };
      Object.entries(updates).forEach(([field, value]) => {
        if (field.startsWith('specs.')) {
          next.specs = { ...(next.specs || {}), [field.split('.')[1]]: value };
        } else if (field.startsWith('specFiles.')) {
          next.specFiles = { ...(next.specFiles || {}), [field.split('.')[1]]: value };
        } else {
          (next as any)[field] = value;
        }
      });
      newItems[index] = next;
      return newItems;
    });
  };

  const handleAddItem = () => {
    setAdditionalItems([
      ...additionalItems,
      { title: '', tier1Id: '', tier2Id: '', tier3Id: '', price: '', specs: {}, specFiles: {}, imageUrl: '', imageFile: null }
    ]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!primaryItem.tier3Id) return toast.error("Please select a primary category");
    
    setSubmitting(true);
    try {
      const processItem = async (item: any, namePrefix: string) => {
        let finalImageUrl = item.imageUrl;
        if (item.imageFile) {
          finalImageUrl = await uploadImage(item.imageFile, `products/${user.uid}/${Date.now()}_${namePrefix}_main`);
        }
        
        const finalSpecs = { ...item.specs };
        if (item.specFiles) {
          for (const [sname, file] of Object.entries(item.specFiles)) {
             if (file) {
               const uploadedUrl = await uploadImage(file as File, `products/${user.uid}/${Date.now()}_${namePrefix}_spec_${sname}`);
               finalSpecs[sname] = uploadedUrl;
             }
          }
        }
        
        return {
           title: item.title,
           category: item.tier3Id,
           price: Number(item.price || 0),
           specs: finalSpecs,
           images: finalImageUrl ? [finalImageUrl] : []
        };
      };

      const primaryProcessed = await processItem(primaryItem, 'primary');

      const commonUploadedUrls = [];
      for (const file of commonImageFiles) {
        const url = await uploadImage(file, `products/${user.uid}/${Date.now()}_common_${Math.random().toString(36).substring(7)}`);
        commonUploadedUrls.push(url);
      }
      const finalCommonImages = [...commonImages, ...commonUploadedUrls];
      
      const productData: any = {
        sellerId: user.uid,
        title: productTitle,
        description,
        status,
        isMultiItem,
        createdAt: serverTimestamp(),
        category: primaryProcessed.category,
        price: primaryProcessed.price,
        specs: primaryProcessed.specs,
        images: finalCommonImages.length > 0 ? finalCommonImages : primaryProcessed.images
      };

      if (isMultiItem) {
        const additionalProcessed = [];
        additionalProcessed.push(primaryProcessed); // Include primary in items list
        for (let i = 0; i < additionalItems.length; i++) {
          if (additionalItems[i].tier3Id) { // Basic validation
             additionalProcessed.push(await processItem(additionalItems[i], `add_${i}`));
          }
        }
        productData.items = additionalProcessed;
      }
      
      if (isEdit && id) {
        await updateDoc(doc(db, 'products', id), {
          ...productData,
          updatedAt: serverTimestamp()
        });
        toast.success("Product updated successfully");
      } else {
        await addDoc(collection(db, 'products'), productData);
        toast.success("Product added successfully");
      }
      navigate('/seller/products');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'products');
      toast.error("Failed to save product");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="max-w-4xl mx-auto">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>{isEdit ? t('seller.edit') : t('form.add')}</CardTitle>
          <div className="flex items-center gap-2">
            <Label htmlFor="multiItem" className="cursor-pointer">복수 품목 등록</Label>
            <input 
              type="checkbox" 
              id="multiItem" 
              checked={isMultiItem} 
              onChange={e => setIsMultiItem(e.target.checked)} 
              className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="space-y-4">
            <h3 className="font-bold text-lg border-b pb-2">{isMultiItem ? "공통 상품 정보 (대표)" : "상품 정보"}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 col-span-full">
                <Label htmlFor="productTitle">상품명 (전체 목록에 표시됨)</Label>
                <Input id="productTitle" required value={productTitle} onChange={e => setProductTitle(e.target.value)} placeholder="상품의 이름을 입력하세요" />
              </div>
              <div className="space-y-2 col-span-full">
                <Label htmlFor="description">{t('form.description')}</Label>
                <Textarea id="description" required rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="상품의 전체적인 모음이나 구성을 설명하세요." />
              </div>
              <div className="space-y-4 col-span-full pt-2">
                <Label>상품 대표 사진 (최대 5장) - 선택사항</Label>
                <Input 
                  type="file" 
                  accept="image/*" 
                  multiple
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    const totalCount = commonImages.length + commonImageFiles.length + files.length;
                    if (totalCount > 5) {
                      toast.error("대표 사진은 최대 5장까지만 등록 가능합니다.");
                      return;
                    }
                    setCommonImageFiles(prev => [...prev, ...files]);
                  }} 
                />
                <div className="flex flex-wrap gap-3 mt-2">
                  {commonImages.map((url, idx) => (
                    <div key={`url-${idx}`} className="relative w-24 h-24 rounded-md overflow-hidden border">
                      <img src={url} alt="기존 사진" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      <button type="button" onClick={() => setCommonImages(prev => prev.filter((_, i) => i !== idx))} className="absolute top-1 right-1 bg-black/50 hover:bg-red-500 rounded-full text-white p-1 transition-colors">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  {commonImageFiles.map((file, idx) => (
                    <div key={`file-${idx}`} className="relative w-24 h-24 rounded-md overflow-hidden border">
                      <img src={URL.createObjectURL(file)} alt="새 사진" className="w-full h-full object-cover" />
                      <button type="button" onClick={() => setCommonImageFiles(prev => prev.filter((_, i) => i !== idx))} className="absolute top-1 right-1 bg-black/50 hover:bg-red-500 rounded-full text-white p-1 transition-colors">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <ItemEditor 
            item={primaryItem} 
            index={0} 
            isPrimary={true} 
            categories={categories} 
            onUpdate={handleUpdatePrimary} 
            t={t} 
          />

          {isMultiItem && (
            <div className="space-y-4 pt-4 border-t">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-lg">추가 품목</h3>
                <Button type="button" variant="outline" size="sm" onClick={handleAddItem} className="gap-2 bg-slate-50">
                  <Plus className="h-4 w-4" /> 품목 추가
                </Button>
              </div>
              
              {additionalItems.map((item, idx) => (
                <ItemEditor 
                  key={idx}
                  item={item} 
                  index={idx + 1} 
                  isPrimary={false} 
                  categories={categories} 
                  onUpdate={(updates) => handleUpdateAdditional(idx, updates)} 
                  onRemove={() => setAdditionalItems(prev => prev.filter((_, i) => i !== idx))}
                  t={t} 
                />
              ))}
              {additionalItems.length === 0 && (
                <p className="text-center text-slate-500 py-8 text-sm border-2 border-dashed rounded-lg bg-slate-50">
                  추가 품목이 없습니다. "품목 추가" 버튼을 눌러 부속품이나 추가 상품을 등록하세요.
                </p>
              )}
            </div>
          )}

          <div className="space-y-2 pt-4 border-t">
            <Label htmlFor="status">{t('form.status')}</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="available">{t('status.available')}</SelectItem>
                <SelectItem value="reserved">{t('status.reserved')}</SelectItem>
                <SelectItem value="sold">{t('status.sold')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="pt-6 flex justify-end gap-3 border-t">
            <Button type="button" variant="outline" size="lg" onClick={() => navigate('/seller/products')}>취소</Button>
            <Button type="submit" size="lg" disabled={submitting}>{isEdit ? "상품 수정" : "상품 등록"}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

const QuoteProductSummary = ({ productId }: { productId: string }) => {
  const [product, setProduct] = useState<any>(null);
  
  useEffect(() => {
    getDoc(doc(db, 'products', productId)).then(snap => {
      if (snap.exists()) setProduct({ id: snap.id, ...snap.data() });
    });
  }, [productId]);

  if (!product) return <div className="animate-pulse h-16 w-full bg-slate-100 rounded-lg my-2"></div>;

  return (
    <Link to={`/product/${productId}`} className="flex items-center gap-4 mt-2 p-3 bg-slate-50 hover:bg-slate-100 transition-colors rounded-lg border">
      {product.images && product.images[0] ? (
        <img src={product.images[0]} alt={product.title} className="w-16 h-16 rounded object-cover border bg-white" referrerPolicy="no-referrer" />
      ) : (
        <div className="w-16 h-16 rounded border bg-slate-200 flex items-center justify-center">
          <Package className="w-8 h-8 text-slate-400" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="font-bold text-slate-900 truncate">{product.title}</p>
        <p className="text-sm text-slate-500 truncate mt-0.5">{product.description}</p>
        <p className="text-xs text-primary font-medium mt-1">상세보기 &rarr;</p>
      </div>
    </Link>
  );
};

function ReceivedQuotes({ onGoToTransactions }: { onGoToTransactions: () => void }) {
  const { user, profile } = useAuth();
  const [quotes, setQuotes] = useState<any[]>([]);
  const { t } = useLanguage();
  const [counterPrice, setCounterPrice] = useState<Record<string, string>>({});
  const [counterMessage, setCounterMessage] = useState<Record<string, string>>({});
  const [showCounterForm, setShowCounterForm] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'quoteRequests'), where('sellerId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const qs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
      qs.sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis());
      setQuotes(qs);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'quoteRequests'));
    return () => unsubscribe();
  }, [user]);

  const handleResponse = async (quote: any, status: 'accepted' | 'rejected' | 'counter_offered') => {
    try {
      const updateData: any = { status };
      
      if (status === 'counter_offered') {
        const price = Number(counterPrice[quote.id]);
        if (!price || isNaN(price)) return toast.error("Please enter a valid counter price");
        updateData.counterPrice = price;
        updateData.counterMessage = counterMessage[quote.id] || '';
      }

      await updateDoc(doc(db, 'quoteRequests', quote.id), updateData);
      
      if (status === 'accepted') {
        await updateDoc(doc(db, 'products', quote.productId), { status: 'sold' });
        
        const prodDoc = await getDoc(doc(db, 'products', quote.productId));
        const prodData = prodDoc.data();

        // Determine final price based on the state it was accepted from
        let finalPrice = quote.quotePrice;
        if (quote.status === 'counter_offered') finalPrice = quote.counterPrice; // If admin accepted seller's counter
        if (quote.status === 'second_quoted') finalPrice = quote.secondQuotePrice; // If seller accepted admin's 2nd quote

        // Create transaction
        await addDoc(collection(db, 'transactions'), {
          productId: quote.productId,
          sellerId: user.uid,
          quoteId: quote.id,
          phase: 'in_progress',
          status: 'preparing',
          finalPrice: finalPrice,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

        await addDoc(collection(db, 'transactionNotifications'), {
          productId: quote.productId,
          productTitle: prodData?.title || 'Unknown Product',
          sellerName: profile?.name || 'Seller',
          message: `Platform purchased for ₩${finalPrice.toLocaleString()}!`,
          createdAt: serverTimestamp()
        });
      }
      toast.success(`Quote ${status}`);
      setShowCounterForm(prev => ({ ...prev, [quote.id]: false }));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `quoteRequests/${quote.id}`);
      toast.error("Failed to update quote");
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">{t('seller.receivedQuotes')}</h2>
      <div className="grid gap-4">
        {quotes.map(quote => (
          <Card key={quote.id}>
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">
                    {t('seller.receivedQuotes')}
                  </CardTitle>
                  <CardDescription>Quote received on {quote.createdAt?.toDate().toLocaleDateString()}</CardDescription>
                </div>
                <Badge variant={
                  quote.status === 'quoted' ? 'default' : 
                  quote.status === 'counter_offered' ? 'secondary' :
                  quote.status === 'second_quoted' ? 'default' :
                  quote.status === 'accepted' ? 'outline' : 'destructive'
                }>
                  {quote.status === 'do_not_buy' ? t('status.rejected') : (t(`status.${quote.status}` as any, { iteration: quote.iteration || 1 }) || quote.status)}
                </Badge>
              </div>
              <QuoteProductSummary productId={quote.productId} />
            </CardHeader>
            <CardContent>
              <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg mb-4">
                <div className="flex justify-between items-center mb-1">
                  <p className="text-sm text-blue-800 font-medium">{t('quote.adminQuote')}</p>
                  {quote.iteration > 1 && (
                    <Badge variant="secondary" className="text-[10px]">{t('quote.iteration', { iteration: quote.iteration })}</Badge>
                  )}
                </div>
                <p className="text-2xl font-bold text-blue-900 mb-2">₩{quote.quotePrice?.toLocaleString()}</p>
                {quote.message && <p className="text-sm text-slate-600">{quote.message}</p>}
              </div>

              {quote.counterPrice && (
                <div className="bg-orange-50 border border-orange-100 p-4 rounded-lg mb-4 ml-8">
                  <p className="text-sm text-orange-800 font-medium mb-1">{t('quote.sellerCounter')}</p>
                  <p className="text-xl font-bold text-orange-900 mb-2">₩{quote.counterPrice?.toLocaleString()}</p>
                  {quote.counterMessage && <p className="text-sm text-slate-600">{quote.counterMessage}</p>}
                </div>
              )}

              {quote.secondQuotePrice && (
                <div className="bg-purple-50 border border-purple-100 p-4 rounded-lg mb-4">
                  <p className="text-sm text-purple-800 font-medium mb-1">{t('quote.adminSecond')}</p>
                  <p className="text-2xl font-bold text-purple-900 mb-2">₩{quote.secondQuotePrice?.toLocaleString()}</p>
                  {quote.secondQuoteMessage && <p className="text-sm text-slate-600">{quote.secondQuoteMessage}</p>}
                </div>
              )}

              {(quote.status === 'quoted' || quote.status === 'second_quoted') && !showCounterForm[quote.id] && (
                <div className="flex gap-2">
                  <Button onClick={() => handleResponse(quote, 'accepted')} className="flex-1 bg-green-600 hover:bg-green-700 gap-2">
                    <Check className="h-4 w-4" /> {t('seller.accept')}
                  </Button>
                  {quote.status === 'quoted' && (
                    <Button onClick={() => setShowCounterForm(prev => ({ ...prev, [quote.id]: true }))} variant="outline" className="flex-1 gap-2">
                      <Send className="h-4 w-4" /> {t('quote.counterOffer')}
                    </Button>
                  )}
                  <Button onClick={() => handleResponse(quote, 'rejected')} variant="destructive" className="flex-1 gap-2">
                    <X className="h-4 w-4" /> {t('seller.reject')}
                  </Button>
                </div>
              )}

              {showCounterForm[quote.id] && (
                <div className="mt-4 p-4 border rounded-lg bg-slate-50 space-y-4">
                  <h4 className="font-semibold">{t('quote.sendCounter')}</h4>
                  <div className="space-y-2">
                    <Label>{t('quote.counterPrice')}</Label>
                    <Input 
                      type="number" 
                      value={counterPrice[quote.id] || ''} 
                      onChange={e => setCounterPrice(prev => ({ ...prev, [quote.id]: e.target.value }))} 
                      placeholder="e.g. 60000" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('quote.message')}</Label>
                    <Textarea 
                      value={counterMessage[quote.id] || ''} 
                      onChange={e => setCounterMessage(prev => ({ ...prev, [quote.id]: e.target.value }))} 
                      placeholder="Reason for counter offer..." 
                    />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button variant="ghost" onClick={() => setShowCounterForm(prev => ({ ...prev, [quote.id]: false }))}>{t('form.cancel')}</Button>
                    <Button onClick={() => handleResponse(quote, 'counter_offered')}>{t('quote.sendCounter')}</Button>
                  </div>
                </div>
              )}

              {quote.status === 'accepted' && (
                <div className="flex flex-col gap-3">
                  <div className="bg-green-50 border border-green-100 p-4 rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-2 text-green-700 font-medium">
                      <Check className="h-5 w-5" />
                      {t('seller.quoteAccepted')}
                    </div>
                    <Button size="sm" onClick={onGoToTransactions} className="gap-2">
                      <Truck className="h-4 w-4" /> {t('seller.goToShipping' as any) || 'Go to Shipping'}
                    </Button>
                  </div>
                </div>
              )}
              
              {quote.status === 'rejected' && (
                <div className="bg-red-50 border border-red-100 p-4 rounded-lg text-red-700 font-medium flex items-center gap-2">
                  <X className="h-5 w-5" />
                  {t('seller.quoteRejected')}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {quotes.length === 0 && (
          <div className="py-12 text-center text-slate-500 border-2 border-dashed rounded-lg">
            {t('seller.noQuotes')}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SellerDashboard() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('products');
  const [counts, setCounts] = useState({
    products: 0,
    quotes: 0,
    transactions: 0
  });

  useEffect(() => {
    if (!user) return;

    // Listen for available product count (판매중)
    const qProducts = query(
      collection(db, 'products'), 
      where('sellerId', '==', user.uid),
      where('status', '==', 'available')
    );
    const unsubProducts = onSnapshot(qProducts, (snap) => {
      setCounts(prev => ({ ...prev, products: snap.size }));
    });

    // Listen for pending quotes count (seller needs to act)
    const qQuotes = query(
      collection(db, 'quoteRequests'), 
      where('sellerId', '==', user.uid),
      where('status', 'in', ['quoted', 'second_quoted'])
    );
    const unsubQuotes = onSnapshot(qQuotes, (snap) => {
      setCounts(prev => ({ ...prev, quotes: snap.size }));
    });

    // Listen for pending transactions count (seller needs to act)
    const qTx = query(
      collection(db, 'transactions'),
      where('sellerId', '==', user.uid)
    );
    const unsubTx = onSnapshot(qTx, (snap) => {
      const pendingTx = snap.docs.filter(doc => {
        const data = doc.data();
        return (data.phase === 'in_progress' && data.status === 'preparing') || 
               (data.phase === 'completed' && data.status === 'final_offer');
      });
      setCounts(prev => ({ ...prev, transactions: pendingTx.length }));
    });

    return () => {
      unsubProducts();
      unsubQuotes();
      unsubTx();
    };
  }, [user]);

  useEffect(() => {
    if (!loading && profile?.role !== 'seller' && profile?.role !== 'admin') {
      toast.error("Access denied. Sellers only.");
      navigate('/');
    }
  }, [profile, loading, navigate]);

  if (loading) return <div>Loading...</div>;
  if (profile?.role !== 'seller' && profile?.role !== 'admin') return null;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{t('seller.title')}</h1>
        <p className="text-slate-500">{t('seller.desc')}</p>
      </div>

      <Routes>
        <Route path="/" element={
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="mb-6">
              <TabsTrigger value="products" className="gap-2">
                <Package className="h-4 w-4" /> 
                {t('seller.myProducts')}
                {counts.products > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 min-w-5 flex items-center justify-center p-0 text-[10px]">
                    {counts.products}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="quotes" className="gap-2">
                <MessageSquare className="h-4 w-4" /> 
                {t('seller.receivedQuotes')}
                {counts.quotes > 0 && (
                  <Badge variant="destructive" className="ml-1 h-5 min-w-5 flex items-center justify-center p-0 text-[10px]">
                    {counts.quotes}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="transactions" className="gap-2">
                <Truck className="h-4 w-4" /> 
                {t('seller.transactions')}
                {counts.transactions > 0 && (
                  <Badge variant="destructive" className="ml-1 h-5 min-w-5 flex items-center justify-center p-0 text-[10px]">
                    {counts.transactions}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="products">
              <SellerProducts />
            </TabsContent>
            <TabsContent value="quotes">
              <ReceivedQuotes onGoToTransactions={() => setActiveTab('transactions')} />
            </TabsContent>
            <TabsContent value="transactions">
              <Transactions />
            </TabsContent>
          </Tabs>
        } />
        <Route path="/products/new" element={<ProductForm />} />
        <Route path="/products/:id/edit" element={<ProductForm isEdit />} />
      </Routes>
    </div>
  );
}
