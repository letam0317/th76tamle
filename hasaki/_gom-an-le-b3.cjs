const c=require(process.cwd()+"/.exports/tasks-cache.json");const H=c.header;const rows=Object.values(c.rows);
const g=(r,n)=>{const i=H.findIndex(h=>h.startsWith(n));return i<0?"":(r[i]||"")};
const cm=require(process.cwd()+"/.exports/comments-cache.json");
const nv=c.nvNames||{};
const out=[];
for(const r of rows){
 const b31=g(r,"B3.1 Ghi nhận vi phạm vệ sinh kho tổng ▸ Status"),b32=g(r,"B3.2 Ghi nhận vi phạm quy định kho tổng ▸ Status");
 if(b31!="Finished"&&b32!="Finished")continue;
 const id=r[1].split("=")[1];
 const lines=s=>String(s).split(/\n/).filter(Boolean);
 const vid=lines(g(r,"B1. Xác minh lỗi vi phạm ▸ Video"));
 const anh=lines(g(r,"B1. Xác minh lỗi vi phạm ▸ Hình ảnh bằng chứng"));
 const nvv=String(g(r,"B1. Xác minh lỗi vi phạm ▸ Nhân viên vi phạm")).split(",").filter(Boolean);
 out.push({id,code:r[0],tao:r[5],nguoiGhi:r[4],ngayVP:g(r,"Ngày vi phạm"),loi:g(r,"Lỗi vi phạm"),viTri:g(r,"Vị trí ghi nhận"),
  anhVP:lines(g(r,"Hình ảnh vi phạm")),videoVP:lines(g(r,"Video vi phạm")),
  b1Nguoi:g(r,"B1. Xác minh lỗi vi phạm ▸ Người thực hiện"),b1QL:g(r,"B1. Xác minh lỗi vi phạm ▸ Quản lý"),b1Giao:g(r,"B1. Xác minh lỗi vi phạm ▸ Ngày giao"),b1Xong:g(r,"B1. Xác minh lỗi vi phạm ▸ Deadline"),
  nvVP:nvv.map(x=>(c.nvCodes||{})[x]||x).map(x=>x+" "+(nv[x]||"")),
  b1Anh:anh,b1Video:vid,
  b11:g(r,"B1.1 Nhân viên xác nhận lỗi vi phạm ▸ Xác nhận lỗi"),b11GT:g(r,"B1.1 Nhân viên xác nhận lỗi vi phạm ▸ Giải trình"),
  b2:g(r,"B2. QLTT xác nhận và giải trình ▸ Xác nhận lỗi"),b2GT:g(r,"B2. QLTT xác nhận và giải trình ▸ Giải trình"),
  nhanh:b31=="Finished"?(b32=="Finished"?"B3.1+B3.2":"B3.1"):"B3.2",
  b4:g(r,"B4. Audit kiểm tra và xác nhận ▸ Xác nhận lỗi"),b4GC:g(r,"B4. Audit kiểm tra và xác nhận ▸ Ghi chú"),
  cmt:((cm[id]||{}).rows||[]).map(x=>({ai:x.ten,luc:x.luc,nd:x.nd,files:(x.files||[]).length}))});
}
require("fs").writeFileSync(process.argv[2],JSON.stringify(out,null,1));
const by={};for(const o of out){const k=o.loi.slice(0,70);(by[k]=by[k]||[]).push(o)}
for(const [k,v] of Object.entries(by).sort((a,b)=>b[1].length-a[1].length)){
 const ev={vid:v.filter(o=>o.b1Video.length).length,cm:v.filter(o=>o.cmt.length).length,multi:v.filter(o=>o.nvVP.length>1).length};
 console.log(v.length,"|",k,"| video",ev.vid,"cmt",ev.cm,"nhieuNV",ev.multi,"|",[...new Set(v.map(o=>o.nhanh))].join(","));
}
