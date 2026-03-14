// Firebase設定
// ※ここにFirebaseコンソールからコピーした設定を貼り付けてください
// https://console.firebase.google.com/ でプロジェクト作成後、
// プロジェクト設定 > 全般 > マイアプリ > ウェブアプリ追加 で取得できます

var firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "123456789",
  appId: "YOUR_APP_ID"
};

// Firebase初期化
var db = null;
try {
  if (typeof firebase !== 'undefined' && firebaseConfig.apiKey !== 'YOUR_API_KEY') {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
  }
} catch (e) {
  console.log('Firebase初期化スキップ:', e.message);
}
