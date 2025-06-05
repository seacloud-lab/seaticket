import { isWorkWeixin } from '../components-form/utils/weixin-utils';

test("Test work weixin user agent", () => {
  let userAgent1 = 'mozilla/5.0 (iphone; cpu iphone os 16_0 like mac os x) applewebkit/605.1.15 (khtml, like gecko)  mobile/15e148 wxwork/4.0.10 micromessenger/7.0.1 language/zh colorscheme/light';
  let userAgent2 = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.0.0 Safari/537.36';
  expect(isWorkWeixin(userAgent1.toLowerCase())).toEqual(true);
  expect(isWorkWeixin(userAgent2.toLowerCase())).toEqual(false);
});
