/* lienanh-xuat.js — MÔ-ĐUN THUẦN (không three.js, không DOM) cho công cụ bố trí kho Liên Anh (05/10/2026)
 * Dùng chung cho lienanh-3d.html (trình duyệt) và bộ đo qc-lienanh-3d.mjs (node, nạp qua vm).
 *   X.nha(TS,GIA)            → khổ nhà + trục cột + cột (từ CHUỖI kích thước, tự cộng — lệch tổng là ok=false)
 *   X.khungLocal(v,GIA)      → hộp chiếm sàn trong hệ cục bộ của 1 món (chưa xoay)
 *   X.tuyetDoi(v,khuMap)     → tâm tuyệt đối (khu cha + rx/rz)
 *   X.vetVat(v,khuMap,GIA)   → AABB {x,y,w,h} (y = z) sau khi xoay — cùng khuôn vetVat của kho170-3d
 *   X.dienTich(k)            → m² (w·d hoặc shoelace nếu có pts)
 *   X.kiemLuat(model)        → [{ma, muc, a, b, kc, min, mo}] theo lienanh-luat.js
 *   X.hinh2D(model)          → danh sách hình nguyên thuỷ (mét, x phải · z xuống đúng tờ bản vẽ)
 *   X.xuatSVG(model,opt) · X.xuatDXF(model,opt) → chuỗi tệp
 * Hệ toạ độ: x = 0 ở trục 1, z = 0 ở trục M (mép trên tờ vẽ). xoay (độ) theo three.js: 90 = quay ngược chiều kim đồng hồ
 * trên tờ vẽ (local +x → lên trên). Góc cung dùng quy ước "model-up": cos → +x, sin → −z (= +Y của DXF). */
(function(root){
'use strict';
const X={};
const r2=v=>Math.round(v*100)/100, r1=v=>Math.round(v*10)/10;
const DEG=Math.PI/180;
X.r2=r2;

/* ───────────────── 1. NHÀ: từ chuỗi kích thước ───────────────── */
function trucTu(chuoi){const ds=[0];let a=0;(chuoi.buoc||[]).forEach(b=>{a+=b;ds.push(r2(a/1000))});return ds}
X.nha=function(TS,GIA){
 GIA=GIA||{};const g=id=>{const t=X.timTs(TS,id);return GIA[id]!==undefined?+GIA[id]:(t?+t.gt:NaN)};
 const cx=trucTu(TS.chuoiX),cz=trucTu(TS.chuoiZ);
 const tongX=(TS.chuoiX.buoc||[]).reduce((a,b)=>a+b,0),tongZ=(TS.chuoiZ.buoc||[]).reduce((a,b)=>a+b,0);
 const HX=tongX/1000,HZ=tongZ/1000;
 const ok=tongX===TS.chuoiX.tong&&tongZ===TS.chuoiZ.tong&&cx.length===TS.chuoiX.nhan.length&&cz.length===TS.chuoiZ.nhan.length;
 const zCot=[0,g('cotGiua1'),g('cotGiua2'),HZ].filter(v=>isFinite(v));
 const cot=[];cx.forEach(x=>zCot.forEach(z=>cot.push({x,z})));
 cz.forEach(z=>{if(!zCot.some(q=>Math.abs(q-z)<1e-6)){cot.push({x:0,z});cot.push({x:HX,z})}});
 return {ok,HX,HZ,tongX,tongZ,X:cx,Z:cz,nhanX:TS.chuoiX.nhan,nhanZ:TS.chuoiZ.nhan,cot,zCot,
  cotCanh:g('cotCanh')||0.45,tuongDay:g('tuongDay')||0.25,loi:ok?'':'Chuỗi kích thước không khớp tổng khai báo ('+tongX+' / '+TS.chuoiX.tong+' · '+tongZ+' / '+TS.chuoiZ.tong+')'}};
X.timTs=function(TS,id){for(const n of TS.nhom||[])for(const t of n.ts||[])if(t.id===id)return t;return null};
X.giaTri=function(TS,GIA,id){const t=X.timTs(TS,id);return GIA&&GIA[id]!==undefined?+GIA[id]:(t?+t.gt:NaN)};

/* ───────────────── 2. SORTER: kích thước cục bộ (hệ S của trang mẫu) ───────────────── */
/* Hệ S (trang mẫu): ring x ∈ [0,XL], z ∈ [−ZW/2, ZW/2]; line nạp xe ở x > XL; line #5 ở x < 0.
   Trang mẫu đặt S xoay 180° tại (PX,PZ) ⇒ thế giới = (PX − xS, PZ − zS). Ta chọn TÂM món = (PX,PZ)
   ⇒ toạ độ cục bộ của món (xoay 0) = (−xS, −zS): line nạp xe ở local x ÂM (phía tường trục 1), line #5 ở local x DƯƠNG. */
X.sorterKT=function(GIA,tram){
 const g=(k,d)=>GIA&&isFinite(+GIA[k])?+GIA[k]:d;
 const Ls=g('soLs',31.5),Lw=g('soLw',10),R=g('soR',3.5),H=g('soH',2.4),AISLE=g('soLoi',2.0),nLine=g('soLine',4);
 const XL=Ls+2*R,ZW=Lw+2*R,TW=0.9,CAGE_H=1.3,CAGE_D=1.2,CH_ANG=25*DEG;
 const CH_DY=H-(CAGE_H+0.25),CH_LEN=CH_DY/Math.sin(CH_ANG),CH_DX=CH_LEN*Math.cos(CH_ANG),D_CAGE=CH_DX+0.35;
 const CH_DY_B=H-0.75,CH_LEN_B=CH_DY_B/Math.sin(CH_ANG),CH_DX_B=CH_LEN_B*Math.cos(CH_ANG),D_PAL_B=CH_DX_B+0.6+0.8+0.6,PAL_D=1.2;
 const doc=(H-0.85)/Math.tan(15*DEG);
 const FEED_LEN=0.45+1.2+2.0+doc+1.5+1.0+0.9;                 // line nạp xe: mép ray → đầu băng (+ người)
 const L5=0.45+1.2+2.0+doc+0.3+3.6+0.6+0.8;                   // line #5: mép ray → cổng dán nhãn → đầu băng + người
 const outA=TW/2+D_CAGE+CAGE_D/2+AISLE, outB=TW/2+D_PAL_B+PAL_D/2+AISLE;   // từ mép ray ra hết lối ngoài
 const out=(tram==='manual'?outB:outA);
 return {Ls,Lw,R,H,XL,ZW,TW,AISLE,nLine,CH_DX,CH_DX_B,D_CAGE,D_PAL_B,CAGE_D,PAL_D,CH_LEN,CH_LEN_B,doc,FEED_LEN,L5,outA,outB,out,
  /* hộp cục bộ của MÓN (đã đổi dấu): x từ −(XL+FEED_LEN+0.5) tới L5, z ±(ZW/2 + out) (gồm máng, lồng, lối kéo lồng ngoài) */
  x0:r2(-(XL+FEED_LEN+0.5)),x1:r2(L5),z0:r2(-(ZW/2+out)),z1:r2(ZW/2+out),dong:r2(out)}};

/* ───────────────── 3. HÌNH HỌC MÓN ───────────────── */
X.LOAI_KE={dayKe:1};
X.kichThuocKe=function(v,GIA){const g=(k,d)=>GIA&&isFinite(+GIA[k])?+GIA[k]:d;
 const bay=g('keBay',2.4),sau=g('keSau',1.0),khe=g('keKhe',0.3),hang=g('keDDHang',4),n=Math.max(1,Math.round(+v.nBay||10));
 const kieu=v.kieu||'sel';const L=r2(n*bay+0.09);
 const D=kieu==='dd'?r2(hang*sau):kieu==='don'?r2(sau+0.1):r2(2*sau+khe);
 const hangDs=kieu==='dd'?Array.from({length:hang},(_,i)=>r2(-D/2+sau*(i+0.5))):kieu==='don'?[0]:[r2(-(sau+khe)/2),r2((sau+khe)/2)];
 return {bay,sau,khe,n,kieu,L,D,hangDs,viTri:n*2*(kieu==='dd'?hang:kieu==='don'?1:2)*g('keTang',4)}};
X.khungLocal=function(v,GIA){
 if(v.loai==='dayKe'){const k=X.kichThuocKe(v,GIA);return {x0:-k.L/2,z0:-k.D/2,x1:k.L/2,z1:k.D/2}}
 if(v.loai==='sorter'){const s=X.sorterKT(GIA,v.tram);return {x0:s.x0,z0:s.z0,x1:s.x1,z1:s.z1}}
 const w=+v.w||1,d=+v.d||1;return {x0:-w/2,z0:-d/2,x1:w/2,z1:d/2}};
/* xoay three.js (rotation.y = θ): (x,z) → (x cosθ + z sinθ, −x sinθ + z cosθ) */
X.xoayDiem=function(x,z,xoay){const a=(xoay||0)*DEG,c=Math.cos(a),s=Math.sin(a);return [x*c+z*s,-x*s+z*c]};
X.tuyetDoi=function(v,khuMap){const k=khuMap&&v.khu?khuMap[v.khu]:null;return {x:r2((k?+k.x:0)+(+v.rx||0)),z:r2((k?+k.z:0)+(+v.rz||0))}};
X.vetVat=function(v,khuMap,GIA){const c=X.tuyetDoi(v,khuMap),L=X.khungLocal(v,GIA);
 const P=[[L.x0,L.z0],[L.x1,L.z0],[L.x1,L.z1],[L.x0,L.z1]].map(p=>X.xoayDiem(p[0],p[1],v.xoay));
 const xs=P.map(p=>p[0]),zs=P.map(p=>p[1]);
 return {x:r2(c.x+Math.min(...xs)),y:r2(c.z+Math.min(...zs)),w:r2(Math.max(...xs)-Math.min(...xs)),h:r2(Math.max(...zs)-Math.min(...zs))}};
/* hộp CON (chi tiết hơn AABB) — sorter = khối chính (ring + line nạp + máng/lồng + lối ngoài) + dải line #5 mảnh;
   các món khác = 1 hộp. Bộ luật so hộp con để line #5 không biến cả vùng đông ring thành "sorter". */
X.hopCon=function(v,khuMap,GIA){if(v.loai!=='sorter')return [X.vetVat(v,khuMap,GIA)];
 const c=X.tuyetDoi(v,khuMap),s=X.sorterKT(GIA,v.tram),a=v.xoay||0;
 const hop=(x0,z0,x1,z1)=>{const P=[[x0,z0],[x1,z0],[x1,z1],[x0,z1]].map(p=>X.xoayDiem(p[0],p[1],a));const xs=P.map(p=>p[0]),zs=P.map(p=>p[1]);
  return {x:r2(c.x+Math.min(...xs)),y:r2(c.z+Math.min(...zs)),w:r2(Math.max(...xs)-Math.min(...xs)),h:r2(Math.max(...zs)-Math.min(...zs))}};
 const dong=s.dong;                                                          // mép đông khối chính = tim lối kéo lồng phía đông ring
 return [hop(s.x0,s.z0,dong,s.z1),hop(dong,-1.6,s.x1,1.6)]};
X.vetKhu=function(k){if(k.pts&&k.pts.length>=3){const xs=k.pts.map(p=>+k.x+p[0]),zs=k.pts.map(p=>+k.z+p[1]);
  return {x:r2(Math.min(...xs)),y:r2(Math.min(...zs)),w:r2(Math.max(...xs)-Math.min(...xs)),h:r2(Math.max(...zs)-Math.min(...zs))}}
 return {x:+k.x,y:+k.z,w:+k.w,h:+k.d}};
X.ptsKhu=function(k){if(k.pts&&k.pts.length>=3)return k.pts.map(p=>[r2(+k.x+p[0]),r2(+k.z+p[1])]);
 return [[+k.x,+k.z],[r2(+k.x+ +k.w),+k.z],[r2(+k.x+ +k.w),r2(+k.z+ +k.d)],[+k.x,r2(+k.z+ +k.d)]]};
X.dienTich=function(k){if(k.pts&&k.pts.length>=3){let s=0;const p=k.pts;for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length];s+=a[0]*b[1]-b[0]*a[1]}return r1(Math.abs(s)/2)}
 return r1((+k.w||0)*(+k.d||0))};
X.khuMap=function(KHU){const m={};(KHU||[]).forEach(k=>m[k.id]=k);return m};
/* khoảng cách giữa 2 hộp AABB theo từng trục (âm = chồng) */
X.khe=function(A,B){return {gx:r2(Math.max(B.x-(A.x+A.w),A.x-(B.x+B.w))),gz:r2(Math.max(B.y-(A.y+A.h),A.y-(B.y+B.h)))}};
X.chong=function(A,B,e){e=e||0.01;return A.x<B.x+B.w-e&&B.x<A.x+A.w-e&&A.y<B.y+B.h-e&&B.y<A.y+A.h-e};
X.trong=function(A,B,e){e=e||0.02;return A.x>=B.x-e&&A.y>=B.y-e&&A.x+A.w<=B.x+B.w+e&&A.y+A.h<=B.y+B.h+e};
/* khoảng cách "lối" giữa 2 hộp: chồng hình chiếu 1 trục thì = khe trục kia; tách cả 2 trục → max(gx,gz) */
X.kcLoi=function(A,B){const k=X.khe(A,B);if(k.gx<0&&k.gz<0)return {kc:Math.max(k.gx,k.gz),de:true};if(k.gx<0)return {kc:k.gz,truc:'z'};if(k.gz<0)return {kc:k.gx,truc:'x'};return {kc:Math.max(k.gx,k.gz),goc:true}};

/* ───────────────── 4. BỘ LUẬT ───────────────── */
const VAT_ROI={ban:1,locker:1,keMam:1,keV:1,keLuoi:1,gheNhua:1,palletDen:1,xeNangTay:1,xeSat2Tang:1,baoBong:1,thungGiay:1,quay:1,gheCho:1,tuSac:1,oXeNang:1,cay:1,mayLanh:1,cumLong:1,vach:1,cuaSat:1,cuaSo:1,cuaCuon:1,banAn:1,mcs:1,song:1,xeMay:1};
const NGOAI_NHA={dockCont:1,xeTai19:1,cua:1};
X.kiemLuat=function(M){
 const TS=M.TS,GIA=M.GIA||{},LUAT=(M.LUAT&&M.LUAT.luat)||[],KHU=M.KHU||[],VAT=M.VAT||[];
 const N=X.nha(TS,GIA),km=X.khuMap(KHU),ds=[];
 const L={};LUAT.forEach(l=>L[l.ma]=Object.assign({},l,M.luatSua&&M.luatSua[l.ma]||{}));
 const bao=(ma,a,b,kc,min,mo)=>{const l=L[ma]||{muc:'loi'};ds.push({ma,muc:l.muc||'loi',ten:l.ten||ma,a:a&&a.id||a,b:b&&b.id||b,kc:r2(kc),min,mo:mo||''})};
 const hop=VAT.map(v=>({v,id:v.id,loai:v.loai,b:X.vetVat(v,km,GIA),bs:X.hopCon(v,km,GIA)}));
 /* so theo hộp con: chồng nếu BẤT KỲ cặp hộp con chồng; khoảng cách = nhỏ nhất giữa các cặp */
 const chongH=(A,B,e)=>A.bs.some(a=>B.bs.some(b=>X.chong(a,b,e)));
 const kcH=(A,Bb)=>{let best=null;A.bs.forEach(a=>(Bb.bs||[Bb]).forEach(b=>{const k=X.kcLoi(a,b);if(!best||k.de&&!best.de||(!best.de&&!k.de&&k.kc<best.kc))best=k}));return best};
 const hopKhu=KHU.map(k=>({k,id:k.id,b:X.vetKhu(k)}));
 const cotB=N.cot.map(c=>({x:r2(c.x-N.cotCanh/2),y:r2(c.z-N.cotCanh/2),w:N.cotCanh,h:N.cotCanh,c}));
 const nhaB={x:0,y:0,w:N.HX,h:N.HZ};
 const khuCua=id=>{const k=km[id];return k};
 const laKe=h=>h.loai==='dayKe',laSorter=h=>h.loai==='sorter',laRoi=h=>!!VAT_ROI[h.loai],laNgoai=h=>!!NGOAI_NHA[h.loai]||(h.v.khu&&km[h.v.khu]&&km[h.v.khu].ngoai);
 /* ĐÈ NHAU (mọi món trong nhà, trừ cửa/dock/xe tải; cửa sắt nằm trong vách = bỏ) */
 for(let i=0;i<hop.length;i++)for(let j=i+1;j<hop.length;j++){const A=hop[i],B=hop[j];if(laNgoai(A)||laNgoai(B))continue;
  if((A.loai==='vach'&&/^cua/.test(B.loai))||(B.loai==='vach'&&/^cua/.test(A.loai))||(A.loai==='vach'&&B.loai==='vach'))continue;
  if(chongH(A,B,0.012)){const k=kcH(A,B);bao('DE',A,B,k.kc,0,'đè nhau')}}
 /* L01 / L02: dãy kệ ↔ dãy kệ */
 const ke=hop.filter(laKe);const bay=X.giaTri(TS,GIA,'keBay')||2.4;
 for(let i=0;i<ke.length;i++)for(let j=i+1;j<ke.length;j++){const A=ke[i],B=ke[j];
  const dA=((A.v.xoay||0)%180+180)%180,dB=((B.v.xoay||0)%180+180)%180;if(Math.abs(dA-dB)>1)continue;
  const ngang=Math.abs(dA)<1;                                         // trục dài theo x
  const k=X.khe(A.b,B.b);const chongDai=ngang?-k.gx:-k.gz, chongNgan=ngang?-k.gz:-k.gx, kheNgan=ngang?k.gz:k.gx, kheDai=ngang?k.gx:k.gz;
  if(chongDai>=bay-0.05&&kheNgan>=-0.012){const l=L.L01||{min:3,kheLungMin:0.15,kheLungMax:0.5};
   if(kheNgan<=0.012){if(!(A.v.kieu==='don'&&B.v.kieu==='don'))bao('L01',A,B,kheNgan,l.min,'ghép khít 2 dãy (chỉ hợp lệ với kệ đơn đâu lưng)')}
   else if(kheNgan>=l.kheLungMin&&kheNgan<=l.kheLungMax){if(!(A.v.kieu==='don'&&B.v.kieu==='don'))bao('L01',A,B,kheNgan,l.min,'khe lưng '+kheNgan+' m chỉ hợp lệ khi cả hai là kệ đơn')}
   else if(kheNgan<l.min)bao('L01',A,B,kheNgan,l.min,'lối giữa 2 dãy kệ hẹp')}
  else if(chongNgan>=0.5&&kheDai>=-0.012){const l=L.L02||{min:3,noi:0.1};
   if(kheDai>(l.noi||0.1)&&kheDai<l.min)bao('L02',A,B,kheDai,l.min,'khe đầu dãy không phải nối liền, cũng chưa đủ lối cắt')}}
 /* L03: kệ ↔ tường bao */
 ke.forEach(A=>{const l=L.L03||{min:0.5};const g=[A.b.x,N.HX-(A.b.x+A.b.w),A.b.y,N.HZ-(A.b.y+A.b.h)];const ten=['tường trục 1','tường trục 19','tường trục M','tường trục A'];
  g.forEach((d,i)=>{if(d<-0.012)return;if(A.v.kieu==='don'&&d<=0.05)return;if(d<l.min)bao('L03',A,ten[i],d,l.min,'kệ sát tường')})});
 /* L04: cột nhà */
 hop.forEach(A=>{if(laNgoai(A)||A.loai==='vach')return;const l=L.L04||{min:0,minKe:0.1};const min=laKe(A)?(l.minKe||0.1):0;
  cotB.forEach(c=>{const k=kcH(A,c);if(k.de)bao('L04',A,'cột ('+c.c.x+', '+c.c.z+')',k.kc,min,'đè cột nhà');else if(min>0&&!k.goc&&k.kc<min)bao('L04',A,'cột ('+c.c.x+', '+c.c.z+')',k.kc,min,'kệ quá sát cột')})});
 /* L05: đồ rời ↔ đồ rời (lối người) — chỉ đồ "có người đi quanh" (bàn, tủ, kệ nhẹ, quầy, máy); đồ XẾP HÀNG (pallet, xe, bao, lồng, ghế) để sát nhau là bình thường */
 const XEP_HANG={palletDen:1,xeNangTay:1,xeSat2Tang:1,baoBong:1,thungGiay:1,cumLong:1,gheCho:1,gheNhua:1,oXeNang:1,tuSac:1};
 const roi=hop.filter(h=>laRoi(h)&&!laNgoai(h)&&!XEP_HANG[h.loai]);
 for(let i=0;i<roi.length;i++)for(let j=i+1;j<roi.length;j++){const A=roi[i],B=roi[j];const l=L.L05||{min:1.2,chong:0.6,ghepKhit:0.012};
  if(A.loai==='vach'||B.loai==='vach'||/^cua/.test(A.loai)||/^cua/.test(B.loai))continue;
  const k=X.khe(A.b,B.b);const kc=k.gx<0?k.gz:(k.gz<0?k.gx:null);if(kc===null)continue;const ch=k.gx<0?-k.gx:-k.gz;
  if(ch>=(l.chong||0.6)&&kc>(l.ghepKhit||0.012)&&kc<l.min)bao('L05',A,B,kc,l.min,'lối người giữa 2 món hẹp')}
 /* L06: dải trước cửa */
 hop.filter(h=>h.loai==='cua'||h.loai==='dockCont').forEach(C=>{const v=C.v;if(v.kieu==='nap')return;const l=L.L06||{min:3,sauNguoi:1.5};
  const sau=v.kieu==='thoat'?(l.sauNguoi||1.5):l.min;const c=X.tuyetDoi(v,km);const rong=+v.w||4;let D;
  const t=v.tuong||(c.x<1?'T1':c.x>N.HX-1?'T19':c.z<1?'TM':'TA');
  if(t==='T1')D={x:0,y:c.z-rong/2,w:sau,h:rong};else if(t==='T19')D={x:N.HX-sau,y:c.z-rong/2,w:sau,h:rong};else if(t==='TM')D={x:c.x-rong/2,y:0,w:rong,h:sau};else D={x:c.x-rong/2,y:N.HZ-sau,w:rong,h:sau};
  hop.forEach(A=>{if(A===C||laNgoai(A)||A.loai==='cua')return;if(A.bs.some(b=>X.chong(b,D,0.012)))bao('L06',C,A,0,sau,'chắn dải trước cửa '+(v.nhan||v.id))})});
 /* L07 / L08: sorter (L08 chỉ xét CỘT TRONG NHÀ — cột trên tường bao đã nằm trong tường) */
 const cotTrong=cotB.filter(c=>c.c.x>0.5&&c.c.x<N.HX-0.5&&c.c.z>0.5&&c.c.z<N.HZ-0.5);
 hop.filter(laSorter).forEach(S=>{const l7=L.L07||{min:2},l8=L.L08||{min:0.5};
  hop.forEach(A=>{if(A===S||!laKe(A))return;const k=kcH(S,A);if(k.de||(!k.goc&&k.kc<l7.min))bao('L07',S,A,k.kc,l7.min,'kệ quá sát sorter')});
  cotTrong.forEach(c=>{const k=kcH(S,c);if(k.de||(!k.goc&&k.kc<l8.min))bao('L08',S,'cột ('+c.c.x+', '+c.c.z+')',k.kc,l8.min,'sorter sát cột (trạm người xếp: pallet ngoài gần cột)')})});
 /* L09 / L10: sạc xe nâng, khu dễ cháy */
 const sac=hop.filter(h=>h.loai==='tuSac'||h.loai==='oXeNang');const khuChay=hopKhu.filter(h=>h.k.nhom==='chay');
 sac.forEach(S=>{const l=L.L09||{min:1.5};ke.forEach(A=>{const k=X.kcLoi(S.b,A.b);if(k.de||(!k.goc&&k.kc<l.min))bao('L09',S,A,k.kc,l.min,'sạc xe nâng sát kệ')});
  khuChay.forEach(K=>{const l10=L.L10||{min:3};const k=X.kcLoi(S.b,K.b);if(k.de||k.kc<l10.min)bao('L10',K.k,S,k.kc,l10.min,'khu giấy/bóng vụn gần sạc')})});
 /* L11: khu ↔ khu · vật trong khu */
 for(let i=0;i<hopKhu.length;i++)for(let j=i+1;j<hopKhu.length;j++){const A=hopKhu[i],B=hopKhu[j];if(A.k.ngoai||B.k.ngoai||A.k.anSan||B.k.anSan)continue;   // khu 'nha' (cửa gắn tường) bao cả nhà, không tính chồng
  if(X.chong(A.b,B.b,0.012)){const k=X.khe(A.b,B.b);bao('L11',A.k,B.k,Math.max(k.gx,k.gz),0,'khu chồng khu')}}
 hop.forEach(A=>{if(laNgoai(A)||laSorter(A))return;const k=A.v.khu?km[A.v.khu]:null;
  if(!k){ds.push({ma:'L11',muc:'canhBao',ten:'Vật chưa thuộc khu',a:A.id,b:'',kc:0,min:0,mo:'chưa gán khu'});return}
  if(!X.trong(A.b,X.vetKhu(k),0.02))ds.push({ma:'L11',muc:'canhBao',ten:'Vật thò ra ngoài khu',a:A.id,b:k.id,kc:0,min:0,mo:'nằm ngoài biên khu '+(k.ten||k.id)})});
 /* L12: trong nhà */
 hop.forEach(A=>{if(laNgoai(A))return;if(!X.trong(A.b,nhaB,0.012))bao('L12',A,'nhà',0,0,'ra ngoài tường bao')});
 /* L13: dải xe dock ↔ khu ngoài */
 hop.filter(h=>h.loai==='dockCont').forEach(D=>{const c=X.tuyetDoi(D.v,km);const sau=X.giaTri(TS,GIA,'dockXe')||17;const t=D.v.tuong||(c.z>N.HZ/2?'TA':'TM');
  const B=t==='TA'?{x:c.x-1.5,y:N.HZ,w:3,h:sau}:t==='TM'?{x:c.x-1.5,y:-sau,w:3,h:sau}:t==='T1'?{x:-sau,y:c.z-1.5,w:sau,h:3}:{x:N.HX,y:c.z-1.5,w:sau,h:3};
  hopKhu.filter(h=>h.k.ngoai).forEach(K=>{if(X.chong(K.b,B,0.012))bao('L13',D,K.k,0,0,'khu ngoài nhà chồng dải xe dock')})});
 /* L14: staging có cửa xuất trên cạnh */
 hopKhu.filter(h=>h.k.nhom==='staging').forEach(K=>{const co=hop.some(C=>{if(C.loai!=='cua'||C.v.kieu!=='xuat')return false;const c=X.tuyetDoi(C.v,km);const b=K.b;
   const tren=Math.abs(c.x-b.x)<0.5||Math.abs(c.x-(b.x+b.w))<0.5,trenZ=c.z>=b.y-0.5&&c.z<=b.y+b.h+0.5,ngang=Math.abs(c.z-b.y)<0.5||Math.abs(c.z-(b.y+b.h))<0.5,trenX=c.x>=b.x-0.5&&c.x<=b.x+b.w+0.5;
   return (tren&&trenZ)||(ngang&&trenX)});if(!co)bao('L14',K.k,'',0,0,'khu staging không có cửa xuất trên cạnh')});
 ds.sort((a,b)=>(a.muc===b.muc?0:a.muc==='loi'?-1:1)||a.ma.localeCompare(b.ma));
 return ds};
X.demLoi=function(ds){return {loi:ds.filter(d=>d.muc==='loi').length,canhBao:ds.filter(d=>d.muc!=='loi').length}};

/* ───────────────── 5. HÌNH 2D (nguyên thuỷ, mét, x phải · z xuống) ───────────────── */
/* loại hình: {t:'line',p:[x,z],q:[x,z]} · {t:'pline',pts:[[x,z]...],kin:1} · {t:'circle',c,r} ·
   {t:'arc',c,r,a0,a1} (độ, model-up, ngược chiều kim đồng hồ trên tờ vẽ) · {t:'text',p,s,cao,xoay,can:'c'|'l'|'r'} — đều có lop + mau (ACI) */
const LOP={TRUC:{ten:'LA-TRUC',aci:8,ltype:'DASHED',svg:'#9aa3ab'},TUONG:{ten:'LA-TUONG',aci:7,svg:'#1c2430'},COT:{ten:'LA-COT',aci:8,svg:'#5b6470'},
 CUA:{ten:'LA-CUA',aci:4,svg:'#2f5d8a'},KHU:{ten:'LA-KHU',aci:2,svg:'#c9a000',lw:50},KHUCHU:{ten:'LA-KHU-CHU',aci:2,svg:'#8a6d00'},
 KE:{ten:'LA-KE',aci:5,svg:'#2f5d8a'},SORTER:{ten:'LA-BANG-CHUYEN',aci:3,svg:'#2c8a5a'},TB:{ten:'LA-THIET-BI',aci:6,svg:'#7a4a8a'},
 CHU:{ten:'LA-CHU',aci:7,svg:'#1c2430'},KT:{ten:'LA-KICH-THUOC',aci:1,svg:'#b32020'},LOI:{ten:'LA-LOI',aci:1,svg:'#dc2626'}};
X.LOP=LOP;
function datMon(v,c,GIA){const a=(v.xoay||0);return {p:(x,z)=>{const q=X.xoayDiem(x,z,a);return [r2(c.x+q[0]),r2(c.z+q[1])]},ang:d=>d+a}}
function hcnLocal(T,x0,z0,x1,z1,lop){return {t:'pline',kin:1,lop,pts:[T.p(x0,z0),T.p(x1,z0),T.p(x1,z1),T.p(x0,z1)]}}
/* băng tải: đoạn thẳng p→q (local) bề rộng w → polygon */
function bang(T,p,q,w,lop){const dx=q[0]-p[0],dz=q[1]-p[1],L=Math.hypot(dx,dz)||1,nx=-dz/L*w/2,nz=dx/L*w/2;
 return {t:'pline',kin:1,lop,pts:[T.p(p[0]+nx,p[1]+nz),T.p(q[0]+nx,q[1]+nz),T.p(q[0]-nx,q[1]-nz),T.p(p[0]-nx,p[1]-nz)]}}
function textVn(n){return String(n).replace(/\./g,',')}
X.hinh2D=function(M){
 const TS=M.TS,GIA=M.GIA||{},KHU=M.KHU||[],VAT=M.VAT||[],N=X.nha(TS,GIA),km=X.khuMap(KHU),H=[];
 const add=o=>{H.push(o);return o};const tx=(p,s,cao,lop,can,xoay)=>add({t:'text',p,s,cao:cao||0.6,lop:lop||'CHU',can:can||'c',xoay:xoay||0});
 /* trục + bong bóng */
 N.X.forEach((x,i)=>{add({t:'line',p:[x,-3],q:[x,N.HZ+3],lop:'TRUC'});add({t:'circle',c:[x,N.HZ+5.2],r:1.0,lop:'TRUC'});tx([x,N.HZ+5.2],N.nhanX[i],0.9,'TRUC')});
 N.Z.forEach((z,i)=>{add({t:'line',p:[-3,z],q:[N.HX+3,z],lop:'TRUC'});add({t:'circle',c:[N.HX+5.2,z],r:1.0,lop:'TRUC'});tx([N.HX+5.2,z],N.nhanZ[i],0.9,'TRUC')});
 /* tường bao (2 nét: mặt trong + mặt ngoài) + mái phụ đông nét đứt */
 add({t:'pline',kin:1,lop:'TUONG',pts:[[0,0],[N.HX,0],[N.HX,N.HZ],[0,N.HZ]]});
 const td=N.tuongDay;add({t:'pline',kin:1,lop:'TUONG',pts:[[-td,-td],[N.HX+td,-td],[N.HX+td,N.HZ+td],[-td,N.HZ+td]]});
 const mp=X.giaTri(TS,GIA,'maiPhuDong');if(mp>0)add({t:'pline',kin:1,lop:'TRUC',pts:[[N.HX+td,0],[N.HX+td+mp,0],[N.HX+td+mp,N.HZ],[N.HX+td,N.HZ]]});
 /* cột */
 N.cot.forEach(c=>{const h=N.cotCanh/2;add({t:'pline',kin:1,lop:'COT',pts:[[r2(c.x-h),r2(c.z-h)],[r2(c.x+h),r2(c.z-h)],[r2(c.x+h),r2(c.z+h)],[r2(c.x-h),r2(c.z+h)]]})});
 /* khu vực: viền vàng + tên + m² */
 KHU.forEach(k=>{if(k.anSan||k.trongKhay)return;const pts=X.ptsKhu(k),b=X.vetKhu(k),S=X.dienTich(k);add({t:'pline',kin:1,lop:'KHU',pts,dut:!!k.ngoai});
  tx([r2(b.x+b.w/2),r2(b.y+b.h/2-0.5)],k.ten||k.id,0.8,'KHUCHU');tx([r2(b.x+b.w/2),r2(b.y+b.h/2+0.6)],'S = '+textVn(S)+' m²',0.6,'KHUCHU')});
 /* vật */
 VAT.forEach(v=>{const c=X.tuyetDoi(v,km),T=datMon(v,c,GIA);
  if(v.loai==='dayKe'){const k=X.kichThuocKe(v,GIA);k.hangDs.forEach(zc=>add(hcnLocal(T,-k.L/2,zc-k.sau/2,k.L/2,zc+k.sau/2,'KE')));
   for(let i=1;i<k.n;i++){const x=-k.L/2+0.045+i*k.bay;add({t:'line',p:T.p(x,-k.D/2),q:T.p(x,k.D/2),lop:'KE'})}
   tx(T.p(0,0),(k.kieu==='dd'?'DD':k.kieu==='don'?'KỆ ĐƠN':'SEL')+(v.gd?' GĐ'+v.gd:'')+' · '+k.n+' bay · '+k.viTri+' vị trí',0.4,'CHU','c',(v.xoay||0)%180);return}
  if(v.loai==='sorter'){const s=X.sorterKT(GIA,v.tram);const S=(x,z)=>[-x,-z];      // hệ S → cục bộ món
   const XL=s.XL,ZW=s.ZW,R=s.R,TW=s.TW;
   const diem=(x,z)=>{const q=S(x,z);return T.p(q[0],q[1])};
   const goc=(p,c)=>{let a=Math.atan2(-(p[1]-c[1]),p[0]-c[0])/DEG;if(a<0)a+=360;return a};
   [TW/2,-TW/2].forEach(o=>{const Ro=R+o;                                             // 2 mép ray: 4 đoạn thẳng + 4 cung 90°
    const seg=[[[R,-ZW/2-o],[R+s.Ls,-ZW/2-o]],[[XL+o,-ZW/2+R],[XL+o,ZW/2-R]],[[R+s.Ls,ZW/2+o],[R,ZW/2+o]],[[-o,ZW/2-R],[-o,-ZW/2+R]]];
    seg.forEach(q=>add({t:'line',p:diem(q[0][0],q[0][1]),q:diem(q[1][0],q[1][1]),lop:'SORTER'}));
    [[[R+s.Ls,-ZW/2+R],[R+s.Ls,-ZW/2-o],[XL+o,-ZW/2+R]],[[R+s.Ls,ZW/2-R],[XL+o,ZW/2-R],[R+s.Ls,ZW/2+o]],
     [[R,ZW/2-R],[R,ZW/2+o],[-o,ZW/2-R]],[[R,-ZW/2+R],[-o,-ZW/2+R],[R,-ZW/2-o]]].forEach(([cc,e1,e2])=>{
     const c=diem(cc[0],cc[1]),p0=diem(e1[0],e1[1]),p1=diem(e2[0],e2[1]);let a0=goc(p0,c),a1=goc(p1,c);
     if(Math.abs(((a1-a0)%360+360)%360-90)>1){const t=a0;a0=a1;a1=t}                   // chọn chiều ngược kim đồng hồ có góc quét 90°
     add({t:'arc',c,r:Ro,a0:r2(a0),a1:r2(a1),lop:'SORTER'})})});
   /* máng + lồng 2 cạnh dài: 25 máng mỗi bên-trong/ngoài (như trang mẫu: 4 × 25) */
   for(let k=0;k<25;k++){const xs=R+2.55+1.1*k;[[-1,-ZW/2],[1,ZW/2]].forEach(([n,zz])=>{
     const z0=zz+n*TW/2,z1=z0+n*(v.tram==='manual'?s.CH_DX_B+0.6:s.CH_DX);const p=S(xs,z0),q=S(xs,z1);add(bang(T,p,q,0.74,'SORTER'));
     const zc=zz+n*(v.tram==='manual'?s.D_PAL_B:s.D_CAGE);const c2=S(xs,zc);add(hcnLocal(T,c2[0]-0.5,c2[1]-0.6,c2[0]+0.5,c2[1]+0.6,'TB'))})}
   /* line nạp xe (4) + line #5 */
   const xEdge=XL+TW/2,xTop=xEdge+1.2+2.0,xIn=xTop+s.doc;
   for(let i=0;i<s.nLine;i++){const z=-3.6+2.4*i,stag=(i%2)?1:0,x0=xIn+2.5+stag;
    const a=S(x0,z),b=S(xIn,z),c3=S(xTop,z),d=S(xEdge+1.2,z),e=S(XL+0.45,z+1.2);
    add(bang(T,a,b,0.7,'SORTER'));add(bang(T,b,c3,0.7,'SORTER'));add(bang(T,c3,d,0.7,'SORTER'));add(bang(T,d,e,0.7,'SORTER'))}
   {const xE=-TW/2,xG=xE-1.2,xT=xG-2.0,xI=xT-s.doc,x0=xI-0.3-3.6-0.6;const a=S(x0,0),b=S(xI,0),c3=S(xT,0),d=S(xG,0),e=S(xE,-1.2);
    add(bang(T,a,b,0.7,'SORTER'));add(bang(T,b,c3,0.7,'SORTER'));add(bang(T,c3,d,0.7,'SORTER'));add(bang(T,d,e,0.7,'SORTER'));
    const g2=S((xI-0.3-1.8),0);add(hcnLocal(T,g2[0]-0.7,g2[1]-0.65,g2[0]+0.7,g2[1]+0.65,'TB'))}
   /* lối kéo lồng ngoài (viền) */
   add(hcnLocal(T,s.x0,s.z0,s.x1,s.z1,'SORTER')).dut=1;
   const cR=S(XL/2,0);tx(T.p(cR[0],cR[1]),'SORTER CROSS-BELT · ring '+textVn(s.Ls)+'×'+textVn(s.Lw)+' m · '+s.nLine+' line nạp + line #5',0.7,'CHU');return}
  if(v.loai==='cua'||v.loai==='dockCont'){const w=+v.w||4,d=+v.d||0.3;add(hcnLocal(T,-w/2,-d/2,w/2,d/2,'CUA'));
   const lb=v.loai==='dockCont'?'DOCK':(v.kieu==='nap'?'NẠP':v.kieu==='thoat'?'THOÁT':'XUẤT')+(v.moi?' (mới)':'');tx(T.p(0,0),lb,0.35,'CUA','c',(v.xoay||0)%180);return}
  if(v.loai==='xeTai19'){add(hcnLocal(T,-(+v.w||6)/2,-(+v.d||2)/2,(+v.w||6)/2,(+v.d||2)/2,'TRUC')).dut=1;return}
  const L2=X.khungLocal(v,GIA);const o=hcnLocal(T,L2.x0,L2.z0,L2.x1,L2.z1,'TB');if(v.loai==='oXeNang')o.dut=1;add(o);
  if(v.nhan||v.loai==='locker'||v.loai==='quay'||v.loai==='tuSac'||v.loai==='cumLong')tx(T.p(0,0),v.nhan||X.TEN_LOAI[v.loai]||v.loai,0.3,'CHU','c',(v.xoay||0)%180)});
 /* kích thước tổng + chuỗi trục */
 const zk=N.HZ+8.5;add({t:'line',p:[0,zk],q:[N.HX,zk],lop:'KT'});[0,N.HX].forEach(x=>add({t:'line',p:[x,zk-0.8],q:[x,zk+0.8],lop:'KT'}));tx([N.HX/2,zk-0.9],textVn(N.tongX)+' mm',0.9,'KT');
 const xk=N.HX+8.5;add({t:'line',p:[xk,0],q:[xk,N.HZ],lop:'KT'});[0,N.HZ].forEach(z=>add({t:'line',p:[xk-0.8,z],q:[xk+0.8,z],lop:'KT'}));tx([xk+0.9,N.HZ/2],textVn(N.tongZ)+' mm',0.9,'KT','c',90);
 const zc2=N.HZ+7.0;TS.chuoiX.buoc.forEach((b,i)=>tx([r2((N.X[i]+N.X[i+1])/2),zc2],String(b),0.45,'KT'));
 const xc2=N.HX+7.0;TS.chuoiZ.buoc.forEach((b,i)=>tx([xc2,r2((N.Z[i]+N.Z[i+1])/2)],String(b),0.45,'KT','c',90));
 /* mũi tên Bắc */
 const bac=+TS.bacThat||0,bx=N.HX+16,bz=-6;const a=bac*DEG;const ex=bx+Math.sin(a)*4,ez=bz-Math.cos(a)*4;
 add({t:'line',p:[bx,bz],q:[r2(ex),r2(ez)],lop:'KT'});add({t:'circle',c:[bx,bz],r:0.6,lop:'KT'});tx([r2(ex),r2(ez-1.0)],'BẮC ('+bac+'°)',0.7,'KT');
 /* bảng diện tích */
 let yT=4,xT=N.HX+12;tx([xT,yT],'DIỆN TÍCH KHU VỰC',0.9,'CHU','l');yT+=1.6;let tong=0;
 const khuVe=KHU.filter(k=>!k.anSan&&!k.trongKhay);
 khuVe.forEach(k=>{const S=X.dienTich(k);tong+=S;tx([xT,yT],(k.ten||k.id)+(k.ngoai?' (ngoài nhà)':'')+' — '+textVn(S)+' m²',0.6,'CHU','l');yT+=1.1});
 tx([xT,yT+0.3],'Tổng '+khuVe.length+' khu — '+textVn(r1(tong))+' m² · nhà '+textVn(r1(N.HX*N.HZ))+' m²',0.7,'CHU','l');
 /* khung tên */
 const kx=N.HX+12,kz=N.HZ-6;[TS.ten||'Kho Liên Anh',TS.banVe||'',TS.diaChi||'','Bố cục ver '+(M.ver||'')+' · '+(M.ngay||''),'Hệ: x = trục 1→19 · z = trục M→A · DXF mm · 1:200 trên A1'].forEach((s,i)=>{if(s)tx([kx,kz+i*1.0],s,i?0.5:0.8,'CHU','l')});
 /* lỗi luật */
 (M.loi||[]).filter(l=>l.muc==='loi').forEach(l=>{const a=VAT.find(v=>v.id===l.a)||KHU.find(k=>k.id===l.a);if(!a||a.anSan)return;const b=a.loai?X.vetVat(a,km,GIA):X.vetKhu(a);
  add({t:'pline',kin:1,lop:'LOI',pts:[[b.x,b.y],[b.x+b.w,b.y],[b.x+b.w,b.y+b.h],[b.x,b.y+b.h]]});tx([r2(b.x+b.w/2),r2(b.y-0.4)],l.ma+' '+(l.mo||''),0.4,'LOI')});
 return H};
X.TEN_LOAI={khu:'Khu vực',dayKe:'Dãy kệ',sorter:'Sorter cross-belt',cua:'Cửa',dockCont:'Dock cont',xeTai19:'Xe tải 1t9',tuSac:'Tủ sạc',oXeNang:'Ô đậu xe nâng',
 ban:'Bàn',locker:'Tủ locker',keMam:'Kệ mâm sắt',keV:'Kệ V lỗ',keLuoi:'Kệ lưới',gheNhua:'Ghế nhựa',palletDen:'Pallet',xeNangTay:'Xe nâng tay',xeSat2Tang:'Xe sắt 2 tầng',
 baoBong:'Bao bóng vụn',thungGiay:'Giấy tái chế',quay:'Quầy',gheCho:'Ghế chờ',cumLong:'Lồng pallet',vach:'Vách ngăn',cuaSat:'Cửa sắt',cay:'Cây xanh',mayLanh:'Máy lạnh'};

/* ───────────────── 6. SVG ───────────────── */
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const fx=v=>(+v).toFixed(3).replace(/\.?0+$/,'');
X.xuatSVG=function(M,opt){opt=opt||{};const N=X.nha(M.TS,M.GIA),H=X.hinh2D(M);
 const x0=-10,z0=-12,W=N.HX+56,Hh=N.HZ+24;const out=[];
 out.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="'+x0+' '+z0+' '+W+' '+Hh+'" width="'+(opt.px||3600)+'" font-family="Arial, Helvetica, sans-serif">');
 out.push('<rect x="'+x0+'" y="'+z0+'" width="'+W+'" height="'+Hh+'" fill="#ffffff"/>');
 out.push('<style>.TRUC{stroke:#9aa3ab;stroke-width:.05;stroke-dasharray:1.2 .6;fill:none}.TUONG{stroke:#1c2430;stroke-width:.18;fill:none}.COT{stroke:#5b6470;stroke-width:.06;fill:#5b6470}'+
  '.CUA{stroke:#2f5d8a;stroke-width:.08;fill:#dbe7f3}.KHU{stroke:#c9a000;stroke-width:.25;fill:#f2c230;fill-opacity:.22}.KHU.dut{stroke-dasharray:1 .6;fill-opacity:.1}'+
  '.KE{stroke:#2f5d8a;stroke-width:.06;fill:#dde7f2}.SORTER{stroke:#2c8a5a;stroke-width:.07;fill:none}.SORTER.dut{stroke-dasharray:.8 .5}.TB{stroke:#7a4a8a;stroke-width:.05;fill:#efe3f3}.TB.dut{stroke-dasharray:.4 .3;fill:none}'+
  '.KT{stroke:#b32020;stroke-width:.06;fill:none}.LOI{stroke:#dc2626;stroke-width:.2;fill:none;stroke-dasharray:.5 .3}text{fill:#1c2430}text.TRUC{fill:#5b6470}text.KHUCHU{fill:#8a6d00;font-weight:700}text.KT{fill:#b32020}text.LOI{fill:#dc2626;font-weight:700}text.CUA{fill:#2f5d8a}</style>');
 H.forEach(h=>{const cls=h.lop+(h.dut?' dut':'');
  if(h.t==='line')out.push('<line class="'+cls+'" x1="'+fx(h.p[0])+'" y1="'+fx(h.p[1])+'" x2="'+fx(h.q[0])+'" y2="'+fx(h.q[1])+'"/>');
  else if(h.t==='pline')out.push('<polygon class="'+cls+'" points="'+h.pts.map(p=>fx(p[0])+','+fx(p[1])).join(' ')+'"/>');
  else if(h.t==='circle')out.push('<circle class="'+cls+'" cx="'+fx(h.c[0])+'" cy="'+fx(h.c[1])+'" r="'+fx(h.r)+'"'+(h.cungTron?' fill="none"':'')+'/>');
  else if(h.t==='arc'){const P=a=>[h.c[0]+h.r*Math.cos(a*DEG),h.c[1]-h.r*Math.sin(a*DEG)],p0=P(h.a0),p1=P(h.a1),quet=((h.a1-h.a0)%360+360)%360;
   out.push('<path class="'+cls+'" d="M'+fx(p0[0])+' '+fx(p0[1])+' A'+fx(h.r)+' '+fx(h.r)+' 0 '+(quet>180?1:0)+' 0 '+fx(p1[0])+' '+fx(p1[1])+'" fill="none"/>')}
  else if(h.t==='text'){const an=h.can==='l'?'start':h.can==='r'?'end':'middle';
   out.push('<text class="'+h.lop+'" x="'+fx(h.p[0])+'" y="'+fx(h.p[1])+'" font-size="'+fx(h.cao)+'" text-anchor="'+an+'" dominant-baseline="middle"'+(h.xoay?' transform="rotate('+(-h.xoay)+' '+fx(h.p[0])+' '+fx(h.p[1])+')"':'')+'>'+esc(h.s)+'</text>')}});
 out.push('</svg>');return out.join('\n')};

/* ───────────────── 7. DXF (AC1015 / AutoCAD 2000, ASCII, có handle) ───────────────── */
function dxfChu(s){let o='';for(const ch of String(s)){const c=ch.codePointAt(0);o+=c>127?'\\U+'+c.toString(16).toUpperCase().padStart(4,'0'):ch}return o}
X.dxfChu=dxfChu;
X.xuatDXF=function(M,opt){opt=opt||{};const N=X.nha(M.TS,M.GIA),H=X.hinh2D(M);const K=opt.donVi==='m'?1:1000;const ins=opt.donVi==='m'?6:4;
 const L=[];const p=(c,v)=>{L.push(c);L.push(v)};let hd=0x100;const h=()=>(hd++).toString(16).toUpperCase();
 const X_=x=>fx(x*K),Y_=z=>fx((N.HZ-z)*K);                                   // trục A ở đáy ⇒ Y lên
 const lops=Object.values(LOP);
 /* HEADER */
 p(0,'SECTION');p(2,'HEADER');p(9,'$ACADVER');p(1,'AC1015');p(9,'$DWGCODEPAGE');p(3,'ANSI_1252');p(9,'$INSUNITS');p(70,ins);
 p(9,'$EXTMIN');p(10,X_(-12));p(20,Y_(N.HZ+12));p(30,0);p(9,'$EXTMAX');p(10,X_(N.HX+48));p(20,Y_(-12));p(30,0);
 p(9,'$LTSCALE');p(40,K===1000?1000:1);p(9,'$HANDSEED');p(5,'FFFF');p(0,'ENDSEC');
 p(0,'SECTION');p(2,'CLASSES');p(0,'ENDSEC');
 /* TABLES */
 p(0,'SECTION');p(2,'TABLES');
 p(0,'TABLE');p(2,'VPORT');p(5,'8');p(330,'0');p(100,'AcDbSymbolTable');p(70,1);
 p(0,'VPORT');p(5,'29');p(330,'8');p(100,'AcDbSymbolTableRecord');p(100,'AcDbViewportTableRecord');p(2,'*ACTIVE');p(70,0);p(10,0);p(20,0);p(11,1);p(21,1);
 p(12,X_(N.HX/2));p(22,Y_(N.HZ/2));p(13,0);p(23,0);p(14,10);p(24,10);p(15,10);p(25,10);p(16,0);p(26,0);p(36,1);p(17,0);p(27,0);p(37,0);p(40,fx((N.HZ+30)*K));p(41,1.6);p(42,50);p(43,0);p(44,0);p(50,0);p(51,0);p(71,0);p(72,100);p(73,1);p(74,3);p(75,0);p(76,0);p(77,0);p(78,0);
 p(0,'ENDTAB');
 p(0,'TABLE');p(2,'LTYPE');p(5,'5');p(330,'0');p(100,'AcDbSymbolTable');p(70,4);
 [['ByBlock','',[]],['ByLayer','',[]],['Continuous','Solid line',[]],['DASHED','Dashed __ __ __',[1.5*K,-0.75*K]]].forEach((lt,i)=>{
  p(0,'LTYPE');p(5,(0x14+i).toString(16).toUpperCase());p(330,'5');p(100,'AcDbSymbolTableRecord');p(100,'AcDbLinetypeTableRecord');p(2,lt[0]);p(70,0);p(3,lt[1]);p(72,65);p(73,lt[2].length);p(40,fx(lt[2].reduce((a,b)=>a+Math.abs(b),0)));
  lt[2].forEach(d=>{p(49,fx(d));p(74,0)})});
 p(0,'ENDTAB');
 p(0,'TABLE');p(2,'LAYER');p(5,'2');p(330,'0');p(100,'AcDbSymbolTable');p(70,lops.length+1);
 /* 390 = PlotStyleName → PLACEHOLDER handle F trong từ điển ACAD_PLOTSTYLENAME (OBJECTS). Bỏ 390 thì DXFIN từ chối "Error in LAYER Table";
    có 390 mà không có đối tượng F thì AUDIT báo "PlotstyleName Id Invalid" (đã gặp cả hai 05/10). */
 const lay=(ten,aci,lt,lw)=>{p(0,'LAYER');p(5,h());p(330,'2');p(100,'AcDbSymbolTableRecord');p(100,'AcDbLayerTableRecord');p(2,ten);p(70,0);p(62,aci);p(6,lt||'Continuous');p(370,lw||-3);p(390,'F')};
 lay('0',7);lops.forEach(l=>lay(l.ten,l.aci,l.ltype,l.lw));
 p(0,'ENDTAB');
 p(0,'TABLE');p(2,'STYLE');p(5,'3');p(330,'0');p(100,'AcDbSymbolTable');p(70,1);
 p(0,'STYLE');p(5,'11');p(330,'3');p(100,'AcDbSymbolTableRecord');p(100,'AcDbTextStyleTableRecord');p(2,'STANDARD');p(70,0);p(40,0);p(41,1);p(50,0);p(71,0);p(42,2.5);p(3,'arial.ttf');p(4,'');
 p(0,'ENDTAB');
 p(0,'TABLE');p(2,'VIEW');p(5,'6');p(330,'0');p(100,'AcDbSymbolTable');p(70,0);p(0,'ENDTAB');
 p(0,'TABLE');p(2,'UCS');p(5,'7');p(330,'0');p(100,'AcDbSymbolTable');p(70,0);p(0,'ENDTAB');
 p(0,'TABLE');p(2,'APPID');p(5,'9');p(330,'0');p(100,'AcDbSymbolTable');p(70,1);
 p(0,'APPID');p(5,'12');p(330,'9');p(100,'AcDbSymbolTableRecord');p(100,'AcDbRegAppTableRecord');p(2,'ACAD');p(70,0);p(0,'ENDTAB');
 p(0,'TABLE');p(2,'DIMSTYLE');p(5,'A');p(330,'0');p(100,'AcDbSymbolTable');p(70,1);p(100,'AcDbDimStyleTable');p(71,0);
 p(0,'DIMSTYLE');p(105,'27');p(330,'A');p(100,'AcDbSymbolTableRecord');p(100,'AcDbDimStyleTableRecord');p(2,'Standard');p(70,0);p(0,'ENDTAB');
 p(0,'TABLE');p(2,'BLOCK_RECORD');p(5,'1');p(330,'0');p(100,'AcDbSymbolTable');p(70,2);
 p(0,'BLOCK_RECORD');p(5,'1F');p(330,'1');p(100,'AcDbSymbolTableRecord');p(100,'AcDbBlockTableRecord');p(2,'*Model_Space');p(340,'0');
 p(0,'BLOCK_RECORD');p(5,'1B');p(330,'1');p(100,'AcDbSymbolTableRecord');p(100,'AcDbBlockTableRecord');p(2,'*Paper_Space');p(340,'0');
 p(0,'ENDTAB');p(0,'ENDSEC');
 /* BLOCKS */
 p(0,'SECTION');p(2,'BLOCKS');
 p(0,'BLOCK');p(5,'20');p(330,'1F');p(100,'AcDbEntity');p(8,'0');p(100,'AcDbBlockBegin');p(2,'*Model_Space');p(70,0);p(10,0);p(20,0);p(30,0);p(3,'*Model_Space');p(1,'');
 p(0,'ENDBLK');p(5,'21');p(330,'1F');p(100,'AcDbEntity');p(8,'0');p(100,'AcDbBlockEnd');
 p(0,'BLOCK');p(5,'1C');p(330,'1B');p(100,'AcDbEntity');p(67,1);p(8,'0');p(100,'AcDbBlockBegin');p(2,'*Paper_Space');p(70,0);p(10,0);p(20,0);p(30,0);p(3,'*Paper_Space');p(1,'');
 p(0,'ENDBLK');p(5,'1D');p(330,'1B');p(100,'AcDbEntity');p(67,1);p(8,'0');p(100,'AcDbBlockEnd');
 p(0,'ENDSEC');
 /* ENTITIES */
 p(0,'SECTION');p(2,'ENTITIES');
 const ent=(kieu,lop,dut)=>{p(0,kieu);p(5,h());p(330,'1F');p(100,'AcDbEntity');p(8,LOP[lop].ten);if(dut)p(6,'DASHED')};
 let dem={};
 H.forEach(q=>{dem[q.lop]=(dem[q.lop]||0)+1;
  if(q.t==='line'){ent('LINE',q.lop,q.dut);p(100,'AcDbLine');p(10,X_(q.p[0]));p(20,Y_(q.p[1]));p(30,0);p(11,X_(q.q[0]));p(21,Y_(q.q[1]));p(31,0)}
  else if(q.t==='pline'){ent('LWPOLYLINE',q.lop,q.dut);p(100,'AcDbPolyline');p(90,q.pts.length);p(70,q.kin?1:0);p(43,0);q.pts.forEach(pt=>{p(10,X_(pt[0]));p(20,Y_(pt[1]))})}
  else if(q.t==='circle'){ent('CIRCLE',q.lop,q.dut);p(100,'AcDbCircle');p(10,X_(q.c[0]));p(20,Y_(q.c[1]));p(30,0);p(40,fx(q.r*K))}
  else if(q.t==='arc'){ent('ARC',q.lop,q.dut);p(100,'AcDbCircle');p(10,X_(q.c[0]));p(20,Y_(q.c[1]));p(30,0);p(40,fx(q.r*K));p(100,'AcDbArc');p(50,fx(q.a0));p(51,fx(q.a1))}
  else if(q.t==='text'){ent('TEXT',q.lop);p(100,'AcDbText');p(10,X_(q.p[0]));p(20,Y_(q.p[1]));p(30,0);p(40,fx(q.cao*K));p(1,dxfChu(q.s));p(50,fx(q.xoay||0));
   p(72,q.can==='l'?0:q.can==='r'?2:1);p(11,X_(q.p[0]));p(21,Y_(q.p[1]));p(31,0);p(100,'AcDbText');p(73,2)}});
 p(0,'ENDSEC');
 /* OBJECTS */
 p(0,'SECTION');p(2,'OBJECTS');
 p(0,'DICTIONARY');p(5,'C');p(330,'0');p(100,'AcDbDictionary');p(281,1);p(3,'ACAD_GROUP');p(350,'D');p(3,'ACAD_PLOTSTYLENAME');p(350,'E');
 p(0,'DICTIONARY');p(5,'D');p(102,'{ACAD_REACTORS');p(330,'C');p(102,'}');p(330,'C');p(100,'AcDbDictionary');p(281,1);
 p(0,'ACDBDICTIONARYWDFLT');p(5,'E');p(102,'{ACAD_REACTORS');p(330,'C');p(102,'}');p(330,'C');p(100,'AcDbDictionary');p(281,1);p(3,'Normal');p(350,'F');p(100,'AcDbDictionaryWithDefault');p(340,'F');
 p(0,'ACDBPLACEHOLDER');p(5,'F');p(102,'{ACAD_REACTORS');p(330,'E');p(102,'}');p(330,'E');
 p(0,'ENDSEC');p(0,'EOF');
 /* mã nhóm căn phải 3 ký tự như AutoCAD ghi */
 const s=[];for(let i=0;i<L.length;i+=2)s.push(String(L[i]).padStart(3,' ')+'\r\n'+L[i+1]);
 X._demDxf=dem;return s.join('\r\n')+'\r\n'};

/* ───────────────── 8. ĐỌC LẠI DXF (kiểm nhanh không cần AutoCAD) ───────────────── */
X.docDxf=function(txt){const ln=txt.split(/\r?\n/);const ent=[];let cur=null,sec='';
 for(let i=0;i+1<ln.length;i+=2){const c=ln[i].trim(),v=ln[i+1];
  if(c==='0'){if(cur)ent.push(cur);cur=null;if(v==='SECTION'){sec='';continue}if(v==='ENDSEC'){sec='';continue}
   if(sec==='ENTITIES')cur={kieu:v,lop:'',chu:''};continue}
  if(c==='2'&&sec===''&&/^(HEADER|TABLES|BLOCKS|ENTITIES|OBJECTS|CLASSES)$/.test(v)){sec=v;continue}
  if(!cur)continue;if(c==='8')cur.lop=v;else if(c==='1')cur.chu=v;else if(c==='5')cur.handle=v}
 if(cur)ent.push(cur);const theoLop={};ent.forEach(e=>{theoLop[e.lop]=theoLop[e.lop]||{};theoLop[e.lop][e.kieu]=(theoLop[e.lop][e.kieu]||0)+1});
 const handles=ent.map(e=>e.handle).filter(Boolean);const trung=handles.length-new Set(handles).size;
 const nonAscii=/[^\x00-\x7F]/.test(txt);
 return {soEnt:ent.length,theoLop,trung,nonAscii,coEOF:/\r?\n\s*0\r?\nEOF\s*$/.test(txt)}};

root.LIENANH_XUAT=X;
if(typeof module!=='undefined'&&module.exports)module.exports=X;
})(typeof window!=='undefined'?window:globalThis);
