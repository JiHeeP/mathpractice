/** Tailwind 빌드 설정 — CDN 대신 vendor/tailwind.css 를 직접 만들어 쓴다.
 *  클래스 이름이 JS 문자열 안에 들어 있으므로 js/ 와 index.html 을 모두 훑는다.
 *  빌드:  npm run build:css
 */
module.exports = {
  content: ['./index.html', './js/**/*.js', './tools/**/*.html'],
  theme: { extend: {} },
  plugins: []
};
