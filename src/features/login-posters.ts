// 登录页海报:以后上传图片放 src/assets/ 并在这里加一行 {src, caption} 即可,左右箭头自动轮换。
import poster1 from '../assets/login-poster-1.jpg';
import poster2 from '../assets/login-poster-2.jpg';

export interface LoginPoster {
  src: string;
  caption: string;
}

export const LOGIN_POSTERS: LoginPoster[] = [
  { src: poster1, caption: '沙海晨曲' },
  { src: poster2, caption: '荒漠孤峰' },
];
