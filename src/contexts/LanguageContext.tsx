import React, { createContext, useContext, useState, useEffect } from 'react';

type Language = 'en' | 'ko';

const translations = {
  en: {
    // Nav
    'nav.myDashboard': 'My Dashboard',
    'nav.admin': 'Admin',
    'nav.logout': 'Logout',
    'nav.login': 'Login with Google',
    // Home
    'home.latestProducts': 'Latest Products',
    'home.noProducts': 'No products listed yet.',
    'home.loginToViewProducts': 'Please login to view products.',
    'home.recentTransactions': 'Recent Transactions',
    'home.noTransactions': 'No recent transactions.',
    'home.loginToViewTransactions': 'Please login to view transactions.',
    // Product
    'product.notFound': 'Product not found',
    'product.specs': 'Specifications',
    'product.adminQuote': 'Admin Quote',
    'product.statusMsg': 'This product is currently {status}.',
    'product.quotePrice': 'Quote Price (₩)',
    'product.messageToSeller': 'Message to Seller (Optional)',
    'product.sendQuote': 'Send Quote to Seller',
    'product.waitingAdmin': 'Waiting for the admin to review and send a quote.',
    'product.loginToView': 'Please login to view this product.',
    // Seller Dashboard
    'seller.title': 'Seller Dashboard',
    'seller.desc': 'Manage your products and received quotes.',
    'seller.myProducts': 'My Products',
    'seller.addProduct': 'Add Product',
    'seller.edit': 'Edit',
    'seller.noProducts': 'You haven\'t listed any products yet.',
    'seller.receivedQuotes': 'Received Quotes',
    'seller.adminQuote': 'Admin\'s Quote',
    'seller.accept': 'Accept',
    'seller.reject': 'Reject',
    'seller.quoteAccepted': 'You accepted the quote. The platform will process the transaction.',
    'seller.quoteRejected': 'You rejected this quote.',
    'seller.noQuotes': 'No quotes received yet.',
    // Transactions
    'seller.transactions': 'Transactions',
    'admin.transactions': 'Transactions',
    'tx.status': 'Status',
    'tx.finalPrice': 'Final Price',
    'tx.inputTracking': 'Input Tracking Info',
    'tx.submitShipment': 'Submit Shipment',
    'tx.decideAcceptance': 'Decide Acceptance',
    'tx.phase.in_progress': 'In Progress',
    'tx.phase.completed': 'Completed',
    'tx.phase.return': 'Return',
    'tx.status.preparing': 'Preparing for Shipment',
    'tx.status.shipped': 'Shipment Registered',
    'tx.status.delivering': 'Delivery Confirmed',
    'tx.status.delivered': 'Delivery Completed',
    'tx.status.admin_received': 'Admin Receipt Confirmed',
    'tx.status.inspecting': 'Inspecting',
    'tx.status.final_offer': 'Final Price Offered',
    'tx.status.pending_acceptance': 'Acceptance Status',
    'tx.status.pending_remittance': 'Pending Remittance',
    'tx.status.finished': 'Remittance Completed & Transaction Finished',
    'tx.status.return_preparing': 'Preparing for Return Shipment',
    'tx.status.returning': 'Returning',
    'tx.status.returned': 'Return Completed',
    'tx.status.return_finished': 'Return Completed & Transaction Closed',
    // Form
    'form.title': 'Title',
    'form.category': 'Product Type',
    'form.price': 'Price (₩)',
    'form.imageUrl': 'Image URL (Optional)',
    'form.description': 'Description',
    'form.status': 'Status',
    'form.cancel': 'Cancel',
    'form.save': 'Save Changes',
    'form.add': 'Add Product',
    // Admin
    'admin.title': 'Admin Dashboard',
    'admin.desc': 'Platform management and moderation menu.',
    'admin.users': 'User Management',
    'admin.products': 'Product Moderation',
    'admin.logs': 'Completed Transactions',
    'admin.categories': 'Category Management',
    'admin.delete': 'Delete',
    'admin.createCategory': 'Create New Category',
    'admin.catName': 'Category Name',
    'admin.customFields': 'Custom Fields',
    'admin.addField': '+ Add Field',
    'admin.fieldName': 'Field Name (e.g. Model)',
    'admin.saveCategory': 'Save Category',
    'admin.updateCategory': 'Update Category',
    'admin.existingCategories': 'Existing Categories',
    'admin.text': 'Text',
    'admin.image': 'Image',
    'admin.dropdown': 'Dropdown',
    'admin.optionsPlaceholder': 'Options (comma separated)',
    'admin.req': 'Req',
    'admin.quotes': 'Quotes',
    'admin.viewList': 'List View',
    'admin.viewCard': 'Card View',
    'admin.confirmDeleteCat': 'Are you sure you want to delete this category?',
    'admin.confirmDeleteCatSub': 'This category has sub-categories. Deleting it will make them orphans.',
    'admin.confirmDeleteGeneric': 'This action cannot be undone.',
    'quote.counterOffer': 'Counter Offer',
    'quote.sendCounter': 'Send Counter Offer',
    'quote.secondQuote': '2nd Quote',
    'quote.sendSecond': 'Send 2nd Quote',
    'quote.counterPrice': 'Counter Price',
    'quote.secondPrice': '2nd Quote Price',
    'quote.message': 'Message',
    'quote.adminQuote': 'Admin Quote',
    'quote.sellerCounter': 'Seller Counter Offer',
    'quote.adminSecond': 'Admin 2nd Quote',
    // Status
    'status.available': 'Available',
    'status.reserved': 'Reserved',
    'status.sold': 'Sold',
    'status.quoted': '{iteration} Quoted',
    'status.counter_offered': 'Counter Offered',
    'status.second_quoted': '{iteration} Quoted',
    'status.accepted': 'Accepted',
    'status.rejected': 'Rejected',
    'status.do_not_buy': 'Do Not Buy',
    'quote.requote': 'Re-quote',
    'quote.markDnb': 'Mark as Do Not Buy',
    'quote.iteration': 'Iteration: {iteration}',
  },
  ko: {
    // Nav
    'nav.myDashboard': '내 대시보드',
    'nav.admin': '관리자',
    'nav.logout': '로그아웃',
    'nav.login': 'Google 로그인',
    // Home
    'home.latestProducts': '최신 등록 상품',
    'home.noProducts': '등록된 상품이 없습니다.',
    'home.loginToViewProducts': '상품을 보려면 로그인해주세요.',
    'home.recentTransactions': '최근 거래 내역',
    'home.noTransactions': '최근 거래 내역이 없습니다.',
    'home.loginToViewTransactions': '거래 내역을 보려면 로그인해주세요.',
    // Product
    'product.notFound': '상품을 찾을 수 없습니다.',
    'product.specs': '상세 스펙',
    'product.adminQuote': '관리자 매입 견적',
    'product.statusMsg': '이 상품은 현재 {status} 상태입니다.',
    'product.quotePrice': '견적 가격 (₩)',
    'product.messageToSeller': '판매자에게 남길 메시지 (선택)',
    'product.sendQuote': '견적 보내기',
    'product.waitingAdmin': '관리자의 검토 및 견적을 기다리는 중입니다.',
    'product.loginToView': '이 상품을 보려면 로그인해주세요.',
    // Seller Dashboard
    'seller.title': '판매자 대시보드',
    'seller.desc': '내 상품과 받은 견적을 관리하세요.',
    'seller.myProducts': '내 상품',
    'seller.addProduct': '상품 등록',
    'seller.edit': '수정',
    'seller.noProducts': '아직 등록한 상품이 없습니다.',
    'seller.receivedQuotes': '받은 견적',
    'seller.adminQuote': '관리자 견적가',
    'seller.accept': '수락',
    'seller.reject': '거절',
    'seller.quoteAccepted': '견적을 수락했습니다. 플랫폼에서 거래를 진행합니다.',
    'seller.quoteRejected': '이 견적을 거절했습니다.',
    'seller.noQuotes': '아직 받은 견적이 없습니다.',
    // Transactions
    'seller.transactions': '거래 내역',
    'admin.transactions': '거래 관리',
    'tx.status': '진행 상태',
    'tx.finalPrice': '최종 가격',
    'tx.inputTracking': '운송장 정보 입력',
    'tx.submitShipment': '발송 접수',
    'tx.decideAcceptance': '최종 수락 여부 결정',
    'tx.phase.in_progress': '거래 진행중',
    'tx.phase.completed': '거래 완료',
    'tx.phase.return': '반품',
    'tx.status.preparing': '발송 준비중',
    'tx.status.shipped': '발송 접수',
    'tx.status.delivering': '배송 확인',
    'tx.status.delivered': '배송 완료',
    'tx.status.admin_received': '관리자 인수 확인',
    'tx.status.inspecting': '검수중',
    'tx.status.final_offer': '최종 가격 제시',
    'tx.status.pending_acceptance': '수락여부',
    'tx.status.pending_remittance': '송금 대기',
    'tx.status.finished': '송금 완료 및 거래 완료',
    'tx.status.return_preparing': '배송 준비중',
    'tx.status.returning': '배송중',
    'tx.status.returned': '배송완료',
    'tx.status.return_finished': '반품 완료 및 거래 종료',
    // Form
    'form.title': '상품명',
    'form.category': '제품 종류',
    'form.price': '가격 (₩)',
    'form.imageUrl': '이미지 URL (선택)',
    'form.description': '상세 설명',
    'form.status': '상태',
    'form.cancel': '취소',
    'form.save': '변경사항 저장',
    'form.add': '상품 등록',
    // Admin
    'admin.title': '관리자 대시보드',
    'admin.desc': '플랫폼 관리 및 모니터링 메뉴입니다.',
    'admin.users': '사용자 관리',
    'admin.products': '상품 관리',
    'admin.logs': '거래 완료 내역',
    'admin.categories': '품목 관리',
    'admin.delete': '삭제',
    'admin.createCategory': '새 품목 생성',
    'admin.catName': '품목명',
    'admin.customFields': '사양 항목 (필드)',
    'admin.addField': '+ 필드 추가',
    'admin.fieldName': '필드명 (예: 모델명)',
    'admin.saveCategory': '품목 저장',
    'admin.updateCategory': '품목 수정',
    'admin.existingCategories': '등록된 품목 목록',
    'admin.text': '텍스트',
    'admin.image': '이미지',
    'admin.dropdown': '드롭다운',
    'admin.optionsPlaceholder': '옵션 (쉼표로 구분)',
    'admin.req': '필수',
    'admin.quotes': '견적 관리',
    'admin.viewList': '리스트 보기',
    'admin.viewCard': '카드 보기',
    'admin.confirmDeleteCat': '정말로 이 품목을 삭제하시겠습니까?',
    'admin.confirmDeleteCatSub': '이 품목은 하위 품목을 가지고 있습니다. 삭제 시 하위 품목들이 상위 항목을 잃게 됩니다.',
    'admin.confirmDeleteGeneric': '이 작업은 되돌릴 수 없습니다.',
    'quote.counterOffer': '역제안',
    'quote.sendCounter': '역제안 보내기',
    'quote.secondQuote': '2차 제안',
    'quote.sendSecond': '2차 제안 보내기',
    'quote.counterPrice': '역제안 가격',
    'quote.secondPrice': '2차 제안 가격',
    'quote.message': '메시지',
    'quote.adminQuote': '관리자 견적',
    'quote.sellerCounter': '판매자 역제안',
    'quote.adminSecond': '관리자 2차 견적',
    // Status
    'status.available': '판매중',
    'status.reserved': '예약중',
    'status.sold': '판매완료',
    'status.quoted': '{iteration}차 제안됨',
    'status.counter_offered': '역제안됨',
    'status.second_quoted': '{iteration}차 제안됨',
    'status.accepted': '수락됨',
    'status.rejected': '거절됨',
    'status.do_not_buy': '매입 금지',
    'quote.requote': '재견적',
    'quote.markDnb': '매입금지 마킹',
    'quote.iteration': '{iteration}차 견적 제시',
  }
};

type Translations = typeof translations.en;
type TranslationKey = keyof Translations;

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem('app_language');
    return (saved === 'ko' || saved === 'en') ? saved : 'ko';
  });

  useEffect(() => {
    localStorage.setItem('app_language', language);
  }, [language]);

  const t = (key: TranslationKey, params?: Record<string, string | number>) => {
    let text = translations[language][key] || translations['en'][key] || key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(`{${k}}`, String(v));
      });
    }
    return text;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within LanguageProvider');
  return context;
};
