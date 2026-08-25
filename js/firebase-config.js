/* firebase-config.js — Firebase 웹 앱 설정 (공개되어도 되는 값입니다. 보안은 firestore.rules가 담당) */
window.FIREBASE_CONFIG = {
  apiKey:            'AIzaSyD-0OnV9CfNbglUojNh1Sz-WpVzZImereY',
  authDomain:        'mathpractice-1d8f9.firebaseapp.com',
  projectId:         'mathpractice-1d8f9',
  storageBucket:     'mathpractice-1d8f9.firebasestorage.app',
  messagingSenderId: '536574163973',
  appId:             '1:536574163973:web:836636baf0680e5146306c'
};

/* config/app 문서에 teacherPinHash 를 넣지 않았을 때 쓰는 기본 PIN */
window.DEFAULT_TEACHER_PIN = '490800';
