// Firebase設定
var firebaseConfig = {
  apiKey: "AIzaSyDe75sAy_AMiG2GKAFs9RNndWtQ7fU9klQ",
  authDomain: "keibahannnou.firebaseapp.com",
  projectId: "keibahannnou",
  storageBucket: "keibahannnou.firebasestorage.app",
  messagingSenderId: "17262593376",
  appId: "1:17262593376:web:e0eb245ed2b82bc2064a05"
};

// Firebase初期化
var db = null;
try {
  if (typeof firebase !== 'undefined') {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
  }
} catch (e) {
  console.log('Firebase初期化:', e.message);
}
