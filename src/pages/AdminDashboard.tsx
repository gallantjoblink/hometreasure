import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, updateDoc, doc, deleteDoc, orderBy, addDoc, serverTimestamp, writeBatch, getDoc, where, deleteField } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, uploadImage } from '../firebase';
import { useAuth } from '../components/AuthProvider';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { Users, Package, MessageSquare, Trash2, ShieldAlert, ListTree, Truck, CreditCard, RotateCcw, LayoutGrid, List, ChevronRight, ChevronDown, Pencil, X, GripVertical, Plus } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';
import { Link, useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { 
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const ViewToggle = ({ view, setView, t }: { view: 'list' | 'card', setView: (v: 'list' | 'card') => void, t: any }) => (
  <div className="flex bg-slate-100 p-1 rounded-lg">
    <Button 
      variant={view === 'list' ? 'secondary' : 'ghost'} 
      size="sm" 
      onClick={() => setView('list')}
      className="gap-2"
    >
      <List className="h-4 w-4" /> {t('admin.viewList')}
    </Button>
    <Button 
      variant={view === 'card' ? 'secondary' : 'ghost'} 
      size="sm" 
      onClick={() => setView('card')}
      className="gap-2"
    >
      <LayoutGrid className="h-4 w-4" /> {t('admin.viewCard')}
    </Button>
  </div>
);

function TransactionManagement() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [products, setProducts] = useState<Record<string, any>>({});
  const [categories, setCategories] = useState<any[]>([]);
  const { t } = useLanguage();
  const [viewMode, setViewMode] = useState<'list' | 'card'>('list');
  const [finalPrice, setFinalPrice] = useState<Record<string, string>>({});
  const [adminMessage, setAdminMessage] = useState<Record<string, string>>({});
  const [returnTracking, setReturnTracking] = useState<Record<string, string>>({});
  const [returnCourier, setReturnCourier] = useState<Record<string, string>>({});
  const [finalOfferImages, setFinalOfferImages] = useState<Record<string, File[]>>({});
  const [finalOfferImagePreviews, setFinalOfferImagePreviews] = useState<Record<string, string[]>>({});
  const [uploadingImageId, setUploadingImageId] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'transactions'), 
      where('status', 'not-in', ['finished', 'return_finished']),
      orderBy('status'),
      orderBy('updatedAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'transactions'));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'products'), (snapshot) => {
      const pMap: Record<string, any> = {};
      snapshot.docs.forEach(doc => {
        pMap[doc.id] = { id: doc.id, ...doc.data() };
      });
      setProducts(pMap);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'products'));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'categories'), (snapshot) => {
      setCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'categories'));
    return () => unsubscribe();
  }, []);

  const getFullCategoryPath = (productId: string) => {
    const product = products[productId];
    if (!product) return 'Unknown';
    
    // Check for tier1Id, tier2Id, tier3Id
    const { tier1Id, tier2Id, tier3Id } = product;
    const names: string[] = [];
    
    if (tier1Id) names.push(categories.find(c => c.id === tier1Id)?.name || tier1Id);
    if (tier2Id) names.push(categories.find(c => c.id === tier2Id)?.name || tier2Id);
    if (tier3Id) names.push(categories.find(c => c.id === tier3Id)?.name || tier3Id);
    
    if (names.length > 0) return names.join(' > ');
    
    // Fallback to single category field
    return categories.find(c => c.id === product.category)?.name || product.category || 'Unknown';
  };

  const updateTxStatus = async (txId: string, updates: any) => {
    try {
      await updateDoc(doc(db, 'transactions', txId), {
        ...updates,
        updatedAt: serverTimestamp()
      });
      toast.success("Transaction updated");
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `transactions/${txId}`);
    }
  };

  const handleImageChange = (txId: string, files: FileList | null) => {
    if (!files) {
      setFinalOfferImages(prev => ({ ...prev, [txId]: [] }));
      setFinalOfferImagePreviews(prev => ({ ...prev, [txId]: [] }));
      return;
    }

    const fileArray = Array.from(files).slice(0, 3);
    setFinalOfferImages(prev => ({ ...prev, [txId]: fileArray }));

    const previews: string[] = [];
    fileArray.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        previews.push(reader.result as string);
        if (previews.length === fileArray.length) {
          setFinalOfferImagePreviews(prev => ({ ...prev, [txId]: previews }));
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleSendFinalOffer = async (txId: string) => {
    const price = Number(finalPrice[txId]);
    if (!price || isNaN(price)) return toast.error("Enter valid final price");
    
    let imageUrls: string[] = [];
    const files = finalOfferImages[txId] || [];
    
    if (files.length > 0) {
      setUploadingImageId(txId);
      try {
        const uploadPromises = files.map((file, index) => 
          uploadImage(file, `final_offers/${txId}_${index}_${Date.now()}`)
        );
        imageUrls = await Promise.all(uploadPromises);
      } catch (error) {
        setUploadingImageId(null);
        return toast.error("Failed to upload images");
      }
      setUploadingImageId(null);
    }
    
    await updateTxStatus(txId, {
      status: 'final_offer',
      finalPrice: price,
      adminMessage: adminMessage[txId] || '',
      ...(imageUrls.length > 0 ? { finalOfferImages: imageUrls } : {})
    });
  };

  const handleReturnShipment = async (txId: string) => {
    if (!returnTracking[txId] || !returnCourier[txId]) return toast.error("Enter tracking info");
    await updateTxStatus(txId, {
      status: 'return_finished', // Final closure for returns
      trackingNumber: returnTracking[txId],
      courier: returnCourier[txId]
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">{t('admin.transactions')}</h2>
        <ViewToggle view={viewMode} setView={setViewMode} t={t} />
      </div>

      {viewMode === 'card' ? (
        <div className="grid gap-4">
          {transactions.map(tx => (
            <Card key={tx.id}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">TX: {tx.id.slice(0, 8)}</CardTitle>
                    <div className="flex items-center gap-2 mt-1 cursor-pointer hover:bg-slate-50 p-1 rounded transition-colors" onClick={() => setSelectedProduct(products[tx.productId])}>
                      {products[tx.productId]?.images?.[0] && (
                        <img src={products[tx.productId].images[0]} className="w-8 h-8 rounded object-cover" alt="" referrerPolicy="no-referrer" />
                      )}
                      <div className="text-sm">
                        <p className="font-medium line-clamp-1">{products[tx.productId]?.title || 'Unknown Product'}</p>
                        <p className="text-xs text-slate-500">Original Price: ₩{products[tx.productId]?.price?.toLocaleString()}</p>
                      </div>
                    </div>
                    <CardDescription className="mt-1 text-[10px]">Seller ID: {tx.sellerId.slice(0, 12)}...</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline">{tx.phase}</Badge>
                    <Badge>{tx.status}</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Admin Controls based on status */}
                {tx.phase === 'in_progress' && (
                  <div className="flex flex-wrap gap-2">
                    {tx.status === 'shipped' && (
                      <Button size="sm" onClick={() => updateTxStatus(tx.id, { status: 'delivering' })}>Mark as Delivering</Button>
                    )}
                    {tx.status === 'delivering' && (
                      <Button size="sm" onClick={() => updateTxStatus(tx.id, { status: 'delivered' })}>Mark as Delivered</Button>
                    )}
                    {tx.status === 'delivered' && (
                      <Button size="sm" onClick={() => updateTxStatus(tx.id, { phase: 'completed', status: 'inspecting' })}>Confirm Receipt & Start Inspection</Button>
                    )}
                  </div>
                )}

                {tx.phase === 'completed' && (
                  <div className="space-y-4">
                    {tx.status === 'inspecting' && (
                      <div className="p-4 bg-slate-50 rounded-lg border space-y-3">
                        <p className="font-medium">Send Final Offer</p>
                        <div className="grid grid-cols-2 gap-2">
                          <Input type="number" placeholder="Final Price" value={finalPrice[tx.id] || ''} onChange={e => setFinalPrice(prev => ({ ...prev, [tx.id]: e.target.value }))} />
                          <Input placeholder="Message to seller" value={adminMessage[tx.id] || ''} onChange={e => setAdminMessage(prev => ({ ...prev, [tx.id]: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                          <Input type="file" accept="image/*" multiple onChange={e => handleImageChange(tx.id, e.target.files)} />
                          <div className="text-xs text-slate-500">Max 3 images</div>
                          {(finalOfferImagePreviews[tx.id] || []).length > 0 && (
                            <div className="flex gap-2 mt-2 flex-wrap">
                              {finalOfferImagePreviews[tx.id].map((preview, i) => (
                                <img key={i} src={preview} alt={`Preview ${i+1}`} className="w-16 h-16 rounded object-cover border bg-white" />
                              ))}
                            </div>
                          )}
                        </div>
                        <Button size="sm" className="w-full" disabled={uploadingImageId === tx.id} onClick={() => handleSendFinalOffer(tx.id)}>
                          {uploadingImageId === tx.id ? 'Sending...' : 'Send Offer'}
                        </Button>
                      </div>
                    )}
                    {tx.status === 'pending_remittance' && (
                      <Button className="w-full bg-green-600 hover:bg-green-700" onClick={() => updateTxStatus(tx.id, { status: 'finished' })}>
                        Confirm Remittance & Close Transaction
                      </Button>
                    )}
                  </div>
                )}

                {tx.phase === 'return' && tx.status === 'return_preparing' && (
                  <div className="p-4 bg-red-50 rounded-lg border border-red-100 space-y-3">
                    <p className="font-medium text-red-800">Return Shipment Info</p>
                    <div className="grid grid-cols-2 gap-2">
                      <Input placeholder="Courier" value={returnCourier[tx.id] || ''} onChange={e => setReturnCourier(prev => ({ ...prev, [tx.id]: e.target.value }))} />
                      <Input placeholder="Tracking #" value={returnTracking[tx.id] || ''} onChange={e => setReturnTracking(prev => ({ ...prev, [tx.id]: e.target.value }))} />
                    </div>
                    <Button size="sm" variant="destructive" className="w-full" onClick={() => handleReturnShipment(tx.id)}>Ship Back to Seller</Button>
                  </div>
                )}

                <div className="text-xs text-slate-400">
                  Last updated: {tx.updatedAt?.toDate().toLocaleString()}
                </div>
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
                  <th className="p-3 text-left">ID</th>
                  <th className="p-3 text-left">Product</th>
                  <th className="p-3 text-left">Seller</th>
                  <th className="p-3 text-left">Phase</th>
                  <th className="p-3 text-left">Status</th>
                  <th className="p-3 text-left">Last Updated</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map(tx => (
                  <tr key={tx.id} className="border-b hover:bg-slate-50">
                    <td className="p-3 font-mono text-xs">{tx.id.slice(0, 8)}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1 rounded transition-colors" onClick={() => setSelectedProduct(products[tx.productId])}>
                        {products[tx.productId]?.images?.[0] && (
                          <img src={products[tx.productId].images[0]} className="w-10 h-10 rounded object-cover shrink-0 border" alt="" referrerPolicy="no-referrer" />
                        )}
                        <div className="max-w-[150px]">
                          <p className="font-medium line-clamp-1 text-xs">{products[tx.productId]?.title || 'Loading...'}</p>
                          <p className="text-[10px] text-slate-500 font-mono">₩{products[tx.productId]?.price?.toLocaleString()}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-[10px] font-mono text-slate-500">{tx.sellerId.slice(0, 8)}...</td>
                    <td className="p-3"><Badge variant="outline">{tx.phase}</Badge></td>
                    <td className="p-3"><Badge>{tx.status}</Badge></td>
                    <td className="p-3 text-xs text-slate-500">{tx.updatedAt?.toDate().toLocaleString()}</td>
                    <td className="p-3 text-right">
                      <div className="flex flex-col gap-2 min-w-[250px] items-end">
                        {tx.status === 'shipped' && (
                          <Button size="xs" onClick={() => updateTxStatus(tx.id, { status: 'delivering' })}>Mark as Delivering</Button>
                        )}
                        {tx.status === 'delivering' && (
                          <Button size="xs" onClick={() => updateTxStatus(tx.id, { status: 'delivered' })}>Mark as Delivered</Button>
                        )}
                        {tx.status === 'delivered' && (
                          <Button size="xs" onClick={() => updateTxStatus(tx.id, { phase: 'completed', status: 'inspecting' })}>Confirm Receipt & Start Inspection</Button>
                        )}
                        
                        {tx.phase === 'completed' && tx.status === 'inspecting' && (
                          <div className="w-full bg-slate-50 p-3 rounded-lg border text-left mt-2">
                            <p className="font-medium text-xs mb-2">Send Final Offer</p>
                            <div className="flex flex-col gap-2">
                              <Input type="number" placeholder="Final Price" value={finalPrice[tx.id] || ''} onChange={e => setFinalPrice(prev => ({ ...prev, [tx.id]: e.target.value }))} className="h-8 text-xs" />
                              <Input placeholder="Message to seller" value={adminMessage[tx.id] || ''} onChange={e => setAdminMessage(prev => ({ ...prev, [tx.id]: e.target.value }))} className="h-8 text-xs" />
                              <Input type="file" accept="image/*" multiple onChange={e => handleImageChange(tx.id, e.target.files)} className="h-8 text-xs text-slate-500" />
                              <div className="text-[10px] text-slate-500">Max 3 images</div>
                              {(finalOfferImagePreviews[tx.id] || []).length > 0 && (
                                <div className="flex gap-2 flex-wrap justify-end">
                                  {finalOfferImagePreviews[tx.id].map((preview, i) => (
                                    <img key={i} src={preview} alt={`Preview ${i+1}`} className="w-12 h-12 rounded object-cover border bg-white" />
                                  ))}
                                </div>
                              )}
                              <Button size="sm" className="w-full h-8 text-xs" disabled={uploadingImageId === tx.id} onClick={() => handleSendFinalOffer(tx.id)}>
                                {uploadingImageId === tx.id ? 'Sending...' : 'Send Offer'}
                              </Button>
                            </div>
                          </div>
                        )}

                        {tx.phase === 'completed' && tx.status === 'pending_remittance' && (
                          <Button size="xs" className="bg-green-600 hover:bg-green-700 w-full mt-2" onClick={() => updateTxStatus(tx.id, { status: 'finished' })}>
                            Confirm Remittance & Close
                          </Button>
                        )}

                        {tx.phase === 'return' && tx.status === 'return_preparing' && (
                          <div className="w-full bg-red-50 p-3 rounded-lg border border-red-100 text-left mt-2">
                            <p className="font-medium text-xs text-red-800 mb-2">Return Shipment Info</p>
                            <div className="flex flex-col gap-2">
                              <Input placeholder="Courier" value={returnCourier[tx.id] || ''} onChange={e => setReturnCourier(prev => ({ ...prev, [tx.id]: e.target.value }))} className="h-8 text-xs" />
                              <Input placeholder="Tracking #" value={returnTracking[tx.id] || ''} onChange={e => setReturnTracking(prev => ({ ...prev, [tx.id]: e.target.value }))} className="h-8 text-xs" />
                              <Button size="xs" variant="destructive" className="w-full" onClick={() => handleReturnShipment(tx.id)}>Ship Back to Seller</Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Dialog open={!!selectedProduct} onOpenChange={() => setSelectedProduct(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedProduct?.title || 'Product Info'}</DialogTitle>
            <DialogDescription>Detailed product information for inspection</DialogDescription>
          </DialogHeader>
          {selectedProduct && (
            <div className="space-y-6 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="aspect-square bg-slate-100 rounded-lg overflow-hidden border">
                    {selectedProduct.images?.[0] ? (
                      <img 
                        src={selectedProduct.images[0]} 
                        className="w-full h-full object-cover" 
                        alt="" 
                        referrerPolicy="no-referrer" 
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400">No Image</div>
                    )}
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {selectedProduct.images?.slice(1).map((img: string, i: number) => (
                      <img key={i} src={img} className="aspect-square object-cover rounded border bg-white" alt="" referrerPolicy="no-referrer" />
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1">
                    <Label className="text-[10px] text-slate-500 uppercase">Product Name</Label>
                    <p className="font-medium text-lg">{selectedProduct.title}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-slate-500 uppercase">Seller Price</Label>
                    <p className="font-bold text-xl text-primary">₩{selectedProduct.price?.toLocaleString()}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-slate-500 uppercase">Category</Label>
                    <p className="text-sm bg-slate-100 px-2 py-1 rounded inline-block">
                      {getFullCategoryPath(selectedProduct.id)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-slate-500 uppercase">Description</Label>
                    <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{selectedProduct.description}</p>
                  </div>
                  {selectedProduct.specs && Object.keys(selectedProduct.specs).length > 0 && (
                    <div className="space-y-1 pt-2 border-t font-mono text-xs">
                      <Label className="text-[10px] text-slate-500 uppercase font-sans">Specifications</Label>
                      <div className="grid grid-cols-2 gap-y-2 mt-2">
                        {Object.entries(selectedProduct.specs).map(([key, val]: [string, any]) => (
                          <React.Fragment key={key}>
                            <span className="text-slate-500 flex items-center">{key}:</span>
                            <span className="font-medium">
                              {typeof val === 'string' && val.startsWith('data:image/') ? (
                                <img src={val} alt={key} className="h-20 w-20 object-cover rounded border bg-white" referrerPolicy="no-referrer" />
                              ) : (
                                val
                              )}
                            </span>
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setSelectedProduct(null)}>Close</Button>
            <Link to={`/product/${selectedProduct?.id}`} target="_blank">
              <Button className="gap-2">
                Open Full Page <ChevronRight className="h-4 w-4" />
              </Button>
            </Link>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function UserManagement() {
  const [users, setUsers] = useState<any[]>([]);
  const { t } = useLanguage();
  const [viewMode, setViewMode] = useState<'list' | 'card'>('list');

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'users'));
    return () => unsubscribe();
  }, []);

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), { role: newRole });
      toast.success(`User role updated to ${newRole}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
      toast.error("Failed to update user role");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">{t('admin.users')}</h2>
        <ViewToggle view={viewMode} setView={setViewMode} t={t} />
      </div>

      {viewMode === 'card' ? (
        <div className="grid gap-4">
          {users.map(u => (
            <Card key={u.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="font-bold text-lg">{u.name}</p>
                  <p className="text-sm text-slate-500">{u.email}</p>
                  <p className="text-xs text-slate-400 mt-1">UID: {u.uid}</p>
                </div>
                <div className="flex items-center gap-4">
                  <Select value={u.role} onValueChange={(val) => handleRoleChange(u.id, val)}>
                    <SelectTrigger className="w-[130px]">
                      <SelectValue placeholder="Select role">
                        {u.role ? u.role.charAt(0).toUpperCase() + u.role.slice(1) : undefined}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="customer">Customer</SelectItem>
                      <SelectItem value="seller">Seller</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
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
                  <th className="p-3 text-left">Name</th>
                  <th className="p-3 text-left">Email</th>
                  <th className="p-3 text-left">Role</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="border-b hover:bg-slate-50">
                    <td className="p-3 font-medium">{u.name}</td>
                    <td className="p-3 text-slate-600">{u.email}</td>
                    <td className="p-3">
                      <Badge variant={u.role === 'admin' ? 'default' : 'outline'}>{u.role}</Badge>
                    </td>
                    <td className="p-3 text-right">
                      <Select value={u.role} onValueChange={(val) => handleRoleChange(u.id, val)}>
                        <SelectTrigger className="w-[110px] h-8 text-xs ml-auto">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="customer">Customer</SelectItem>
                          <SelectItem value="seller">Seller</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function ProductModeration() {
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const { t } = useLanguage();
  const [viewMode, setViewMode] = useState<'list' | 'card'>('list');

  useEffect(() => {
    const q = query(collection(db, 'products'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'products'));
    return () => unsubscribe();
  }, []);

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

  const handleDelete = async (productId: string) => {
    // window.confirm removed for iframe compatibility
    try {
      await deleteDoc(doc(db, 'products', productId));
      toast.success("Product deleted successfully");
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `products/${productId}`);
      toast.error("Failed to delete product");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">{t('admin.products')}</h2>
        <ViewToggle view={viewMode} setView={setViewMode} t={t} />
      </div>

      {viewMode === 'card' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map(product => (
            <Card key={product.id}>
              <CardHeader className="p-4 pb-2">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg line-clamp-1">{product.title}</CardTitle>
                    <Badge variant="secondary" className="mt-1">{getCategoryName(product.category)}</Badge>
                  </div>
                  <Badge variant={product.status === 'available' ? 'default' : 'secondary'}>
                    {t(`status.${product.status}` as any) || product.status}
                  </Badge>
                </div>
                <CardDescription className="mt-2">Seller ID: {product.sellerId}</CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-0 flex justify-between items-end">
                <p className="font-semibold">₩{product.price.toLocaleString()}</p>
                <div className="flex gap-2">
                  <Link to={`/product/${product.id}`}>
                    <Button variant="outline" size="sm">View</Button>
                  </Link>
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(product.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
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
                  <th className="p-3 text-left">Title</th>
                  <th className="p-3 text-left">Category</th>
                  <th className="p-3 text-left">Price</th>
                  <th className="p-3 text-left">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map(product => (
                  <tr key={product.id} className="border-b hover:bg-slate-50">
                    <td className="p-3 font-medium">{product.title}</td>
                    <td className="p-3"><Badge variant="secondary">{getCategoryName(product.category)}</Badge></td>
                    <td className="p-3">₩{product.price.toLocaleString()}</td>
                    <td className="p-3">
                      <Badge variant={product.status === 'available' ? 'default' : 'secondary'}>
                        {t(`status.${product.status}` as any) || product.status}
                      </Badge>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Link to={`/product/${product.id}`}>
                          <Button variant="outline" size="xs">View</Button>
                        </Link>
                        <Button variant="destructive" size="xs" onClick={() => handleDelete(product.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function TransactionLogs() {
  const [completedTransactions, setCompletedTransactions] = useState<any[]>([]);
  const [products, setProducts] = useState<Record<string, any>>({});
  const { t } = useLanguage();
  const [viewMode, setViewMode] = useState<'list' | 'card'>('list');

  useEffect(() => {
    const q = query(
      collection(db, 'transactions'), 
      where('status', 'in', ['finished', 'return_finished']),
      orderBy('updatedAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setCompletedTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'transactions'));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'products'), (snapshot) => {
      const pMap: Record<string, any> = {};
      snapshot.docs.forEach(doc => { pMap[doc.id] = doc.data(); });
      setProducts(pMap);
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">{t('admin.logs')}</h2>
        <ViewToggle view={viewMode} setView={setViewMode} t={t} />
      </div>

      {viewMode === 'card' ? (
        <div className="grid gap-4">
          {completedTransactions.map(tx => (
            <Card key={tx.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4">
                  {products[tx.productId]?.images?.[0] && (
                    <img src={products[tx.productId].images[0]} className="w-12 h-12 rounded object-cover border" alt="" referrerPolicy="no-referrer" />
                  )}
                  <div>
                    <p className="font-bold">{products[tx.productId]?.title || 'Unknown Product'}</p>
                    <div className="flex gap-2 items-center mt-1">
                      <Badge variant={tx.status === 'finished' ? 'default' : 'destructive'} className="text-[10px]">
                        {tx.status === 'finished' ? 'Completed' : 'Returned'}
                      </Badge>
                      <p className="text-xs text-slate-500">
                        {tx.status === 'finished' ? `Final Price: ₩${tx.finalPrice?.toLocaleString()}` : 'Returned to Seller'}
                      </p>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">Date: {tx.updatedAt?.toDate().toLocaleString()}</p>
                  </div>
                </div>
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
                  <th className="p-3 text-left">Product</th>
                  <th className="p-3 text-left">Status</th>
                  <th className="p-3 text-left">Details</th>
                  <th className="p-3 text-left">Date</th>
                </tr>
              </thead>
              <tbody>
                {completedTransactions.map(tx => (
                  <tr key={tx.id} className="border-b hover:bg-slate-50">
                    <td className="p-3 font-medium flex items-center gap-2">
                       {products[tx.productId]?.images?.[0] && (
                        <img src={products[tx.productId].images[0]} className="w-8 h-8 rounded object-cover border" alt="" referrerPolicy="no-referrer" />
                      )}
                      {products[tx.productId]?.title}
                    </td>
                    <td className="p-3">
                      <Badge variant={tx.status === 'finished' ? 'default' : 'destructive'}>
                        {tx.status === 'finished' ? 'Completed' : 'Returned'}
                      </Badge>
                    </td>
                    <td className="p-3 text-slate-600">
                      {tx.status === 'finished' ? `₩${tx.finalPrice?.toLocaleString()}` : `Tracking: ${tx.trackingNumber}`}
                    </td>
                    <td className="p-3 text-xs text-slate-500">{tx.updatedAt?.toDate().toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

const SortableField: React.FC<{ 
  field: any, 
  index: number, 
  onRemove: (idx: number) => void, 
  onChange: (idx: number, key: string, val: any) => void,
  t: any
}> = ({ field, index, onRemove, onChange, t }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: field.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex flex-col gap-2 bg-slate-50 p-2 rounded-md border border-slate-100 relative group/field">
      <div className="flex gap-2 items-center">
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 hover:bg-slate-200 rounded transition-colors">
          <GripVertical className="h-4 w-4 text-slate-400" />
        </div>
        <Input 
          placeholder={t('admin.fieldName')} 
          value={field.name} 
          onChange={e => onChange(index, 'name', e.target.value)} 
          className="flex-1" 
        />
        <Select value={field.type} onValueChange={v => onChange(index, 'type', v)}>
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="text">{t('admin.text')}</SelectItem>
            <SelectItem value="image">{t('admin.image')}</SelectItem>
            <SelectItem value="dropdown">{t('admin.dropdown')}</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1 px-2">
          <input 
            type="checkbox" 
            id={`req-${index}`} 
            checked={field.required} 
            onChange={e => onChange(index, 'required', e.target.checked)} 
          />
          <Label htmlFor={`req-${index}`} className="text-xs cursor-pointer">{t('admin.req')}</Label>
        </div>
        <Button variant="ghost" size="icon" onClick={() => onRemove(index)} className="text-red-500 h-8 w-8">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      {field.type === 'dropdown' && (
        <Input 
          placeholder="Options (comma separated: Option 1, Option 2...)" 
          value={field.optionsText} 
          onChange={e => onChange(index, 'optionsText', e.target.value)} 
          className="text-xs"
        />
      )}
    </div>
  );
};

const SortableCategoryItem = ({ 
  cat, 
  depth, 
  isExpanded, 
  onToggle, 
  onEdit, 
  onDelete, 
  onAddSub,
  hasChildren,
  t 
}: { 
  cat: any, 
  depth: number, 
  isExpanded: boolean, 
  onToggle: (id: string) => void, 
  onEdit: (cat: any) => void, 
  onDelete: (id: string) => void,
  onAddSub: (cat: any) => void,
  hasChildren: boolean,
  t: any 
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: cat.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 0,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="group">
      <div className="flex items-center justify-between p-3 bg-white border rounded-lg hover:shadow-sm transition-shadow">
        <div className="flex items-center gap-2 flex-1">
          <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 hover:bg-slate-100 rounded transition-colors mr-1">
            <GripVertical className="h-4 w-4 text-slate-400" />
          </div>
          
          {cat.level < 3 ? (
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-6 w-6 p-0" 
              onClick={() => onToggle(cat.id)}
              disabled={!hasChildren}
            >
              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
          ) : (
            <div className="w-6" />
          )}

          <span className={cat.level === 1 ? "font-bold" : cat.level === 2 ? "font-semibold" : ""}>
            {cat.name}
          </span>
          {cat.level === 3 && cat.fields?.length > 0 && (
            <div className="flex gap-1 ml-2 flex-wrap">
              {cat.fields.map((f: any, i: number) => (
                <Badge key={i} variant="secondary" className="text-[10px]">{f.name}</Badge>
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {cat.level < 3 && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => onAddSub(cat)} 
              className="text-green-600 h-8 w-8"
              title="Add Sub-category"
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => onEdit(cat)} 
            className="text-blue-500 h-8 w-8"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => onDelete(cat.id)} 
            className="text-red-500 h-8 w-8"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

function CategoryManagement() {
  const [categories, setCategories] = useState<any[]>([]);
  const { t } = useLanguage();
  const [newCatName, setNewCatName] = useState('');
  const [level, setLevel] = useState<number>(1);
  const [parentId, setParentId] = useState<string>('');
  const [fields, setFields] = useState<{id: string, name: string, type: 'text'|'image'|'dropdown', required: boolean, optionsText?: string}[]>([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const CategoryTree = ({ categories, onDelete, onEdit, onAddSub, t, expandedIds, onToggle, sensors }: { 
    categories: any[], 
    onDelete: (id: string) => void, 
    onEdit: (cat: any) => void, 
    onAddSub: (cat: any) => void,
    t: any,
    expandedIds: Set<string>,
    onToggle: (id: string) => void,
    sensors: any
  }) => {
    const handleTreeDragEnd = async (event: DragEndEvent, parentId: string | null) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const itemsAtLevel = categories
        .filter(c => (parentId ? c.parentId === parentId : c.level === 1))
        .sort((a, b) => (a.order || 0) - (b.order || 0));

      const oldIndex = itemsAtLevel.findIndex(i => i.id === active.id);
      const newIndex = itemsAtLevel.findIndex(i => i.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = arrayMove(itemsAtLevel, oldIndex, newIndex);
        
        // Update orders in Firestore
        const batch = writeBatch(db);
        newOrder.forEach((item, idx) => {
          const ref = doc(db, 'categories', item.id);
          batch.update(ref, { order: idx });
        });
        
        try {
          await batch.commit();
          toast.success("Order updated");
        } catch (error) {
          console.error("Failed to update order", error);
          toast.error("Failed to update order");
        }
      }
    };

    const renderTree = (parentId: string | null = null, depth = 0) => {
      const items = categories
        .filter(c => (parentId ? c.parentId === parentId : c.level === 1))
        .sort((a, b) => (a.order || 0) - (b.order || 0));
      
      if (items.length === 0) return depth === 0 ? <p className="text-center py-8 text-slate-400 italic">No categories found.</p> : null;

      return (
        <DndContext 
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={(e) => handleTreeDragEnd(e, parentId)}
        >
          <SortableContext 
            items={items.map(i => i.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className={depth > 0 ? "ml-6 border-l pl-4 mt-2 space-y-2" : "space-y-2"}>
              {items.map(cat => {
                const hasChildren = categories.some(c => c.parentId === cat.id);
                const isExpanded = expandedIds.has(cat.id);

                return (
                  <div key={cat.id}>
                    <SortableCategoryItem 
                      cat={cat}
                      depth={depth}
                      isExpanded={isExpanded}
                      onToggle={onToggle}
                      onEdit={onEdit}
                      onDelete={onDelete}
                      onAddSub={onAddSub}
                      hasChildren={hasChildren}
                      t={t}
                    />
                    {isExpanded && renderTree(cat.id, depth + 1)}
                  </div>
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      );
    };

    return renderTree();
  };

  useEffect(() => {
    const q = query(collection(db, 'categories'), orderBy('order', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      // Fallback if 'order' field doesn't exist yet (Firestore might error or return empty if index not ready)
      const qFallback = query(collection(db, 'categories'), orderBy('createdAt', 'desc'));
      onSnapshot(qFallback, (snap) => {
        setCategories(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });
    });
    return () => unsubscribe();
  }, []);

  const handleAddField = () => {
    const id = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11);
    setFields([...fields, { id, name: '', type: 'text', required: false, optionsText: '' }]);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setFields((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleFieldChange = (index: number, key: string, value: any) => {
    const newFields = [...fields];
    newFields[index] = { ...newFields[index], [key]: value };
    setFields(newFields);
  };

  const handleRemoveField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index));
  };

  const handleSaveCategory = async () => {
    if (!newCatName.trim()) return toast.error("Category name is required");
    if (level > 1 && !parentId) return toast.error("Parent category is required for level 2 or 3");
    
    try {
      const categoryData: any = {
        name: newCatName,
        level: level,
        fields: fields.filter(f => f.name.trim() !== '').map(f => ({
          name: f.name,
          type: f.type,
          required: f.required,
          ...(f.type === 'dropdown' ? { options: f.optionsText?.split(',').map(s => s.trim()).filter(s => s) || [] } : {})
        })),
        updatedAt: serverTimestamp()
      };

      if (level > 1 && parentId) {
        categoryData.parentId = parentId;
      } else {
        categoryData.parentId = null; // Explicitly clear if level 1
      }

      if (editingId) {
        await updateDoc(doc(db, 'categories', editingId), categoryData);
        toast.success("Category updated");
      } else {
        categoryData.createdAt = serverTimestamp();
        // Set order to end of current level
        const siblings = categories.filter(c => c.parentId === categoryData.parentId && c.level === categoryData.level);
        categoryData.order = siblings.length;
        await addDoc(collection(db, 'categories'), categoryData);
        toast.success("Category created");
      }

      setNewCatName('');
      setParentId('');
      setFields([]);
      setEditingId(null);
      setLevel(1);
    } catch (error) {
      handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, 'categories');
      toast.error(`Failed to ${editingId ? 'update' : 'create'} category`);
    }
  };

  const handleEditCategory = (cat: any) => {
    setEditingId(cat.id);
    setNewCatName(cat.name);
    setLevel(cat.level);
    setParentId(cat.parentId || '');
    setFields(cat.fields?.map((f: any) => ({
      ...f,
      id: f.id || (typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11)),
      optionsText: f.options?.join(', ') || ''
    })) || []);
    
    // Scroll to form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setNewCatName('');
    setParentId('');
    setFields([]);
    setLevel(1);
  };

  const handleAddSubCategory = (parentCat: any) => {
    setEditingId(null);
    setNewCatName('');
    setLevel(parentCat.level + 1);
    setParentId(parentCat.id);
    setFields([]);
    
    // Ensure parent is expanded to see the new item later
    if (!expandedIds.has(parentCat.id)) {
      toggleExpand(parentCat.id);
    }
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteCategory = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'categories', id));
      toast.success("Category deleted");
      setConfirmDeleteId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `categories/${id}`);
      toast.error("Failed to delete category");
    }
  };

  const initiateDelete = (id: string) => {
    setConfirmDeleteId(id);
  };

  const getParentOptions = () => {
    return categories.filter(c => c.level === level - 1);
  };

  return (
    <div className="space-y-8">
      <Card className={editingId ? "border-blue-500 shadow-md" : ""}>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{editingId ? t('admin.updateCategory') : t('admin.createCategory')}</CardTitle>
          {editingId && (
            <Button variant="ghost" size="sm" onClick={cancelEdit} className="gap-2">
              <X className="h-4 w-4" /> {t('form.cancel')}
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Level</Label>
              <Select value={String(level)} onValueChange={v => {
                setLevel(Number(v));
                setParentId('');
                if (Number(v) < 3) setFields([]);
              }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Level 1 (Main)</SelectItem>
                  <SelectItem value="2">Level 2 (Sub)</SelectItem>
                  <SelectItem value="3">Level 3 (Model/Item)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {level > 1 && (
              <div className="space-y-2">
                <Label>Parent Category</Label>
                <Select value={parentId} onValueChange={setParentId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Parent">
                      {parentId ? categories.find(c => c.id === parentId)?.name : undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {getParentOptions().map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>{t('admin.catName')}</Label>
            <Input value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="e.g. Computer, Apple, or MacBook Pro" />
          </div>
          
          {level === 3 && (
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label>{t('admin.customFields')} (Optional)</Label>
                <Button type="button" variant="outline" size="sm" onClick={handleAddField}>{t('admin.addField')}</Button>
              </div>
              <DndContext 
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext 
                  items={fields.map(f => f.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {fields.map((field, idx) => (
                      <SortableField 
                        key={field.id} 
                        field={field} 
                        index={idx} 
                        onRemove={handleRemoveField} 
                        onChange={handleFieldChange} 
                        t={t}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          )}
          <Button onClick={handleSaveCategory} className="w-full">
            {editingId ? t('admin.updateCategory') : t('admin.saveCategory')}
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">{t('admin.existingCategories')}</h3>
        <CategoryTree 
          categories={categories} 
          onDelete={initiateDelete} 
          onEdit={handleEditCategory} 
          onAddSub={handleAddSubCategory}
          t={t} 
          expandedIds={expandedIds}
          onToggle={toggleExpand}
          sensors={sensors}
        />
      </div>

      <Dialog open={!!confirmDeleteId} onOpenChange={(open) => !open && setConfirmDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin.confirmDeleteCat')}</DialogTitle>
            <DialogDescription>
              {confirmDeleteId && categories.some(c => c.parentId === confirmDeleteId) 
                ? t('admin.confirmDeleteCatSub')
                : t('admin.confirmDeleteGeneric')
              }
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setConfirmDeleteId(null)}>{t('form.cancel')}</Button>
            <Button variant="destructive" onClick={() => confirmDeleteId && handleDeleteCategory(confirmDeleteId)}>
              {t('admin.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
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

const QuoteProductSummaryInline = ({ productId }: { productId: string }) => {
  const [product, setProduct] = useState<any>(null);
  
  useEffect(() => {
    getDoc(doc(db, 'products', productId)).then(snap => {
      if (snap.exists()) setProduct({ id: snap.id, ...snap.data() });
    });
  }, [productId]);

  if (!product) return <span className="animate-pulse bg-slate-100 rounded w-20 h-4 inline-block"></span>;

  return (
    <Link to={`/product/${productId}`} className="flex items-center gap-2 hover:bg-slate-50 transition-colors rounded">
      {product.images && product.images[0] ? (
        <img src={product.images[0]} alt={product.title} className="w-8 h-8 rounded object-cover border bg-white" referrerPolicy="no-referrer" />
      ) : (
        <div className="w-8 h-8 rounded border bg-slate-200 flex items-center justify-center">
          <Package className="w-4 h-4 text-slate-400" />
        </div>
      )}
      <span className="font-medium text-slate-900 hover:text-primary hover:underline truncate max-w-[150px]">{product.title}</span>
    </Link>
  );
};

function QuoteManagement() {
  const [quotes, setQuotes] = useState<any[]>([]);
  const { t } = useLanguage();
  const [viewMode, setViewMode] = useState<'list' | 'card'>('list');
  const [secondQuotePrice, setSecondQuotePrice] = useState<Record<string, string>>({});
  const [secondQuoteMessage, setSecondQuoteMessage] = useState<Record<string, string>>({});
  const [activeQuoteId, setActiveQuoteId] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'quoteRequests'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setQuotes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'quoteRequests'));
    return () => unsubscribe();
  }, []);

  const handleResponse = async (quote: any, status: 'accepted' | 'rejected' | 'second_quoted' | 'requoted' | 'do_not_buy') => {
    try {
      let updateData: any = { status };
      
      if (status === 'do_not_buy') {
        updateData.status = 'do_not_buy';
      } else if (status === 'requoted') {
        const price = Number(secondQuotePrice[quote.id]);
        if (!price || isNaN(price)) return toast.error("Please enter a valid requote price");
        
        updateData = {
          status: 'quoted',
          quotePrice: price,
          message: secondQuoteMessage[quote.id] || '',
          iteration: (quote.iteration || 1) + 1,
          // Clear previous negotiation fields
          counterPrice: deleteField(),
          counterMessage: deleteField(),
          secondQuotePrice: deleteField(),
          secondQuoteMessage: deleteField()
        };
      } else if (status === 'second_quoted') {
        const price = Number(secondQuotePrice[quote.id]);
        if (!price || isNaN(price)) return toast.error("Please enter a valid 2nd quote price");
        updateData.secondQuotePrice = price;
        updateData.secondQuoteMessage = secondQuoteMessage[quote.id] || '';
        updateData.iteration = (quote.iteration || 1) + 1;
      }

      await updateDoc(doc(db, 'quoteRequests', quote.id), updateData);
      
      if (status === 'accepted') {
        await updateDoc(doc(db, 'products', quote.productId), { status: 'sold' });
        
        // Fetch product data for notification
        const prodSnap = await getDoc(doc(db, 'products', quote.productId));
        const prodData = prodSnap.data();

        // Create transaction
        await addDoc(collection(db, 'transactions'), {
          productId: quote.productId,
          sellerId: quote.sellerId,
          quoteId: quote.id,
          phase: 'in_progress',
          status: 'preparing',
          finalPrice: quote.counterPrice,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

        await addDoc(collection(db, 'transactionNotifications'), {
          productId: quote.productId,
          productTitle: prodData?.title || 'Unknown Product',
          sellerName: 'System',
          message: `Platform accepted your counter offer for ₩${quote.counterPrice?.toLocaleString()}!`,
          createdAt: serverTimestamp()
        });

        toast.success("Counter offer accepted. Product marked as sold and transaction created.");
      } else {
        toast.success(`Quote ${status}`);
      }
      setActiveQuoteId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `quoteRequests/${quote.id}`);
      toast.error("Failed to update quote");
    }
  };

  const activeQuote = quotes.find(q => q.id === activeQuoteId);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">{t('admin.quotes')}</h2>
        <ViewToggle view={viewMode} setView={setViewMode} t={t} />
      </div>

      {viewMode === 'card' ? (
        <div className="grid gap-4">
          {quotes.map(quote => (
            <Card key={quote.id}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">
                      {t('admin.quotes')}
                    </CardTitle>
                    <CardDescription>Quote sent on {quote.createdAt?.toDate().toLocaleDateString()}</CardDescription>
                  </div>
                  <Badge variant={
                    quote.status === 'quoted' ? 'default' : 
                    quote.status === 'counter_offered' ? 'secondary' :
                    quote.status === 'second_quoted' ? 'default' :
                    quote.status === 'accepted' ? 'outline' : 
                    quote.status === 'do_not_buy' ? 'destructive' : 'destructive'
                  }>
                    {t(`status.${quote.status}` as any, { iteration: quote.iteration || 1 }) || quote.status}
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
                  <div className="bg-purple-50 border border-purple-100 p-4 rounded-lg mb-4 ml-8">
                    <p className="text-sm text-purple-800 font-medium mb-1">{t('quote.adminSecond')}</p>
                    <p className="text-2xl font-bold text-purple-900 mb-2">₩{quote.secondQuotePrice?.toLocaleString()}</p>
                    {quote.secondQuoteMessage && <p className="text-sm text-slate-600">{quote.secondQuoteMessage}</p>}
                  </div>
                )}

                    {quote.status === 'counter_offered' && (
                      <div className="flex gap-2">
                        <Button onClick={() => handleResponse(quote, 'accepted')} className="flex-1 bg-green-600 hover:bg-green-700">
                          Accept Counter
                        </Button>
                        <Button onClick={() => setActiveQuoteId(quote.id)} variant="outline" className="flex-1">
                          {t('quote.sendSecond')}
                        </Button>
                        <Button onClick={() => handleResponse(quote, 'rejected')} variant="destructive" className="flex-1">
                          Reject
                        </Button>
                      </div>
                    )}
                    
                    {(quote.status === 'rejected' || quote.status === 'do_not_buy') && (
                      <div className="flex gap-2">
                        <Button onClick={() => setActiveQuoteId(quote.id)} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white">
                          {t('quote.requote')}
                        </Button>
                        {quote.status !== 'do_not_buy' && (
                          <Button onClick={() => handleResponse(quote, 'do_not_buy')} variant="destructive" className="flex-1">
                            {t('quote.markDnb')}
                          </Button>
                        )}
                      </div>
                    )}

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
                  <th className="p-3 text-left">Product</th>
                  <th className="p-3 text-left">Admin Quote</th>
                  <th className="p-3 text-left">Seller Counter</th>
                  <th className="p-3 text-left">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {quotes.map(quote => (
                  <tr key={quote.id} className="border-b hover:bg-slate-50">
                    <td className="p-3">
                      <QuoteProductSummaryInline productId={quote.productId} />
                    </td>
                    <td className="p-3">₩{quote.quotePrice?.toLocaleString()}</td>
                    <td className="p-3">
                      {quote.counterPrice ? (
                        <div className="flex flex-col">
                          <span>₩{quote.counterPrice.toLocaleString()}</span>
                          {quote.counterMessage && (
                            <span className="text-xs text-slate-500 mt-1 max-w-[200px] truncate" title={quote.counterMessage}>
                              {quote.counterMessage}
                            </span>
                          )}
                        </div>
                      ) : '-'}
                    </td>
                    <td className="p-3">
                      <Badge variant={quote.status === 'quoted' ? 'default' : 'outline'}>
                        {t(`status.${quote.status}` as any, { iteration: quote.iteration || 1 }) || quote.status}
                      </Badge>
                    </td>
                    <td className="p-3 text-right">
                      {quote.status === 'counter_offered' && (
                        <Button size="xs" onClick={() => setActiveQuoteId(quote.id)}>
                          Respond
                        </Button>
                      )}
                      {(quote.status === 'rejected' || quote.status === 'do_not_buy') && (
                        <div className="flex flex-col gap-2 items-end">
                          <Button size="xs" onClick={() => setActiveQuoteId(quote.id)} className="bg-blue-600 hover:bg-blue-700 text-white">
                            {t('quote.requote')}
                          </Button>
                          {quote.status !== 'do_not_buy' && (
                            <Button size="xs" variant="destructive" onClick={() => handleResponse(quote, 'do_not_buy')}>
                              {t('quote.markDnb')}
                            </Button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Secondary Quote / Requote Dialog */}
      <Dialog open={!!activeQuoteId} onOpenChange={(open) => !open && setActiveQuoteId(null)}>
        {activeQuote && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {activeQuote.status === 'counter_offered' ? t('admin.quotes') : 
                 (activeQuote.status === 'rejected' || activeQuote.status === 'do_not_buy') ? t('quote.requote') : t('quote.sendSecond')}
              </DialogTitle>
              <DialogDescription>
                {activeQuote.status === 'counter_offered' 
                  ? "판매자의 역제안에 대해 수락, 거절 또는 2차 제안을 선택하세요."
                  : (activeQuote.status === 'rejected' || activeQuote.status === 'do_not_buy') 
                  ? "거절되거나 매입 금지된 항목에 대해 새로운 견적을 보냅니다."
                  : "판매자에게 2차 최종 견적을 보냅니다."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {activeQuote.status === 'counter_offered' && (
                <div className="bg-orange-50 border border-orange-100 p-4 rounded-lg mb-4">
                  <p className="text-sm text-orange-800 font-medium mb-1">{t('quote.sellerCounter')}</p>
                  <p className="text-xl font-bold text-orange-900 mb-2">₩{activeQuote.counterPrice?.toLocaleString()}</p>
                  {activeQuote.counterMessage && <p className="text-sm text-slate-700 bg-white/50 p-2 rounded">{activeQuote.counterMessage}</p>}
                </div>
              )}
              <div className="space-y-2">
                <Label>{(activeQuote.status === 'rejected' || activeQuote.status === 'do_not_buy') ? "최저 입찰가(재견적가)" : t('quote.secondPrice')}</Label>
                <Input 
                  type="number" 
                  value={secondQuotePrice[activeQuote.id] || ''} 
                  onChange={e => setSecondQuotePrice(prev => ({ ...prev, [activeQuote.id]: e.target.value }))} 
                  placeholder="e.g. 55000" 
                />
              </div>
              <div className="space-y-2">
                <Label>{t('quote.message')}</Label>
                <Textarea 
                  value={secondQuoteMessage[activeQuote.id] || ''} 
                  onChange={e => setSecondQuoteMessage(prev => ({ ...prev, [activeQuote.id]: e.target.value }))} 
                  placeholder="Additional message or reason..." 
                />
              </div>
            </div>
            <DialogFooter className="flex justify-between items-center w-full">
              <div className="flex gap-2">
                {activeQuote.status === 'counter_offered' && (
                  <>
                    <Button variant="destructive" onClick={() => handleResponse(activeQuote, 'rejected')}>
                      {t('seller.reject')}
                    </Button>
                    <Button className="bg-green-600 hover:bg-green-700" onClick={() => handleResponse(activeQuote, 'accepted')}>
                      {t('seller.accept')}
                    </Button>
                  </>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setActiveQuoteId(null)}>{t('form.cancel')}</Button>
                {(activeQuote.status === 'rejected' || activeQuote.status === 'do_not_buy') ? (
                  <Button onClick={() => handleResponse(activeQuote, 'requoted')} className="bg-blue-600 hover:bg-blue-700 text-white">
                    {t('quote.requote')}
                  </Button>
                ) : (
                  <Button onClick={() => handleResponse(activeQuote, 'second_quoted')}>{t('quote.sendSecond')}</Button>
                )}
              </div>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}

export default function AdminDashboard() {
  const { profile, loading } = useAuth();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [counts, setCounts] = useState({
    quotes: 0,
    tx_manage: 0
  });

  useEffect(() => {
    if (!profile || profile.role !== 'admin') return;

    // Listen for pending quotes (seller needs response)
    const qQuotes = query(collection(db, 'quoteRequests'), where('status', '==', 'counter_offered'));
    const unsubQuotes = onSnapshot(qQuotes, (snap) => {
      setCounts(prev => ({ ...prev, quotes: snap.size }));
    });

    // Listen for active transactions
    const qTx = query(
      collection(db, 'transactions'), 
      where('status', 'not-in', ['finished', 'return_finished'])
    );
    const unsubTx = onSnapshot(qTx, (snap) => {
      setCounts(prev => ({ ...prev, tx_manage: snap.size }));
    });

    return () => {
      unsubQuotes();
      unsubTx();
    };
  }, [profile]);

  useEffect(() => {
    if (!loading && profile?.role !== 'admin') {
      toast.error("Access denied. Admins only.");
      navigate('/');
    }
  }, [profile, loading, navigate]);

  if (loading) return <div className="py-12 text-center">Loading...</div>;
  if (profile?.role !== 'admin') return null;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8 flex items-center gap-3">
        <div className="p-3 bg-slate-900 text-white rounded-lg">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">{t('admin.title')}</h1>
          <p className="text-slate-500">{t('admin.desc')}</p>
        </div>
      </div>

      <Tabs defaultValue="users" className="w-full">
        <TabsList className="mb-8 grid w-full grid-cols-6 h-auto p-1 bg-slate-100 rounded-xl">
          <TabsTrigger value="users" className="py-3 gap-2 text-base data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg">
            <Users className="h-5 w-5" /> {t('admin.users')}
          </TabsTrigger>
          <TabsTrigger value="categories" className="py-3 gap-2 text-base data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg">
            <ListTree className="h-5 w-5" /> {t('admin.categories')}
          </TabsTrigger>
          <TabsTrigger value="products" className="py-3 gap-2 text-base data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg">
            <Package className="h-5 w-5" /> {t('admin.products')}
          </TabsTrigger>
          <TabsTrigger value="quotes" className="py-3 gap-2 text-base data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg">
            <MessageSquare className="h-5 w-5" /> 
            {t('admin.quotes')}
            {counts.quotes > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 min-w-5 flex items-center justify-center p-0 text-[10px]">
                {counts.quotes}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="tx_manage" className="py-3 gap-2 text-base data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg">
            <Truck className="h-5 w-5" /> 
            {t('admin.transactions')}
            {counts.tx_manage > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 min-w-5 flex items-center justify-center p-0 text-[10px]">
                {counts.tx_manage}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="transactions" className="py-3 gap-2 text-base data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg">
            <MessageSquare className="h-5 w-5" /> {t('admin.logs')}
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="users" className="mt-0">
          <UserManagement />
        </TabsContent>
        <TabsContent value="categories" className="mt-0">
          <CategoryManagement />
        </TabsContent>
        <TabsContent value="products" className="mt-0">
          <ProductModeration />
        </TabsContent>
        <TabsContent value="quotes" className="mt-0">
          <QuoteManagement />
        </TabsContent>
        <TabsContent value="tx_manage" className="mt-0">
          <TransactionManagement />
        </TabsContent>
        <TabsContent value="transactions" className="mt-0">
          <TransactionLogs />
        </TabsContent>
      </Tabs>
    </div>
  );
}
