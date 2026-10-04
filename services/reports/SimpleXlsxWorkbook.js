/**
 * @fileoverview Minimal dependency-free OOXML .xlsx writer for IQBasket exports.
 * @description Produces standards-based Excel workbooks with inline strings and
 * stored ZIP entries. It intentionally supports only the features IQBasket needs:
 * multiple tabular sheets, headers, widths, filters and frozen header rows.
 */

const encoder = new TextEncoder();

function xmlEscape(value="") {
  return String(value ?? "")
    .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&apos;");
}

function columnName(index) {
  let n=index+1, out="";
  while(n>0){ const r=(n-1)%26; out=String.fromCharCode(65+r)+out; n=Math.floor((n-1)/26); }
  return out;
}

function safeSheetName(value,index) {
  const cleaned=String(value||("Hoja "+(index+1))).replace(/[\\/*?:\[\]]/g," ").trim().slice(0,31);
  return cleaned||("Hoja "+(index+1));
}

function cellXml(value,rowIndex,colIndex,isHeader=false) {
  const ref=columnName(colIndex)+(rowIndex+1);
  const style=isHeader?' s="1"':'';
  if(value===null||value===undefined||value==="") return '<c r="'+ref+'"'+style+'/>';
  if(typeof value==="number" && Number.isFinite(value)) return '<c r="'+ref+'" t="n"'+style+'><v>'+value+'</v></c>';
  if(typeof value==="boolean") return '<c r="'+ref+'" t="b"'+style+'><v>'+(value?1:0)+'</v></c>';
  const text=xmlEscape(value);
  return '<c r="'+ref+'" t="inlineStr"'+style+'><is><t xml:space="preserve">'+text+'</t></is></c>';
}

function worksheetXml(sheet) {
  const rows=Array.isArray(sheet.rows)?sheet.rows:[];
  const maxCols=rows.reduce((m,row)=>Math.max(m,Array.isArray(row)?row.length:0),0);
  const widths=Array.from({length:maxCols},(_,col)=>{
    const explicit=Number(sheet.widths?.[col]);
    if(Number.isFinite(explicit)&&explicit>0) return Math.min(60,Math.max(6,explicit));
    let max=String(rows[0]?.[col]??"").length;
    for(let i=1;i<Math.min(rows.length,250);i++) max=Math.max(max,String(rows[i]?.[col]??"").length);
    return Math.min(38,Math.max(8,max+2));
  });
  const cols=widths.length
    ? '<cols>'+widths.map((w,i)=>'<col min="'+(i+1)+'" max="'+(i+1)+'" width="'+w+'" customWidth="1"/>').join("")+'</cols>'
    : "";
  const sheetRows=rows.map((row,rowIndex)=>
    '<row r="'+(rowIndex+1)+'">'+(row||[]).map((value,colIndex)=>cellXml(value,rowIndex,colIndex,rowIndex===0)).join("")+'</row>'
  ).join("");
  const dimension=maxCols&&rows.length ? 'A1:'+columnName(maxCols-1)+rows.length : 'A1';
  const freeze=sheet.freezeHeader!==false && rows.length
    ? '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
    : '<sheetViews><sheetView workbookViewId="0"/></sheetViews>';
  const filter=sheet.autoFilter!==false && rows.length>1 && maxCols
    ? '<autoFilter ref="A1:'+columnName(maxCols-1)+rows.length+'"/>'
    : "";
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'+
    '<dimension ref="'+dimension+'"/>'+freeze+cols+'<sheetData>'+sheetRows+'</sheetData>'+filter+'</worksheet>';
}

const CRC_TABLE=(()=>{
  const table=new Uint32Array(256);
  for(let i=0;i<256;i++){
    let c=i;
    for(let k=0;k<8;k++) c=(c&1)?(0xEDB88320^(c>>>1)):(c>>>1);
    table[i]=c>>>0;
  }
  return table;
})();

function crc32(bytes) {
  let crc=0xFFFFFFFF;
  for(const byte of bytes) crc=CRC_TABLE[(crc^byte)&0xFF]^(crc>>>8);
  return (crc^0xFFFFFFFF)>>>0;
}

function u16(view,offset,value){view.setUint16(offset,value,true);}
function u32(view,offset,value){view.setUint32(offset,value>>>0,true);}
function concat(chunks) {
  const size=chunks.reduce((sum,c)=>sum+c.length,0);
  const out=new Uint8Array(size);let offset=0;
  chunks.forEach(c=>{out.set(c,offset);offset+=c.length;});
  return out;
}

function zipStore(entries) {
  const locals=[],centrals=[];let offset=0;
  for(const entry of entries){
    const nameBytes=encoder.encode(entry.name);
    const data=typeof entry.data==="string"?encoder.encode(entry.data):entry.data;
    const crc=crc32(data);

    const local=new Uint8Array(30+nameBytes.length);
    const lv=new DataView(local.buffer);
    u32(lv,0,0x04034b50);u16(lv,4,20);u16(lv,6,0x0800);u16(lv,8,0);
    u16(lv,10,0);u16(lv,12,0);u32(lv,14,crc);u32(lv,18,data.length);u32(lv,22,data.length);
    u16(lv,26,nameBytes.length);u16(lv,28,0);local.set(nameBytes,30);
    locals.push(local,data);

    const central=new Uint8Array(46+nameBytes.length);
    const cv=new DataView(central.buffer);
    u32(cv,0,0x02014b50);u16(cv,4,20);u16(cv,6,20);u16(cv,8,0x0800);u16(cv,10,0);
    u16(cv,12,0);u16(cv,14,0);u32(cv,16,crc);u32(cv,20,data.length);u32(cv,24,data.length);
    u16(cv,28,nameBytes.length);u16(cv,30,0);u16(cv,32,0);u16(cv,34,0);u16(cv,36,0);
    u32(cv,38,0);u32(cv,42,offset);central.set(nameBytes,46);
    centrals.push(central);
    offset+=local.length+data.length;
  }
  const centralBytes=concat(centrals);
  const end=new Uint8Array(22);const ev=new DataView(end.buffer);
  u32(ev,0,0x06054b50);u16(ev,4,0);u16(ev,6,0);u16(ev,8,entries.length);u16(ev,10,entries.length);
  u32(ev,12,centralBytes.length);u32(ev,16,offset);u16(ev,20,0);
  return concat([...locals,centralBytes,end]);
}

export function createXlsxWorkbook(sheets=[]) {
  const normalized=(Array.isArray(sheets)?sheets:[])
    .filter(sheet=>sheet&&Array.isArray(sheet.rows))
    .map((sheet,index)=>({...sheet,name:safeSheetName(sheet.name,index)}));
  if(!normalized.length) throw new Error("El libro Excel no contiene hojas.");

  const contentTypes='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'+
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'+
    '<Default Extension="xml" ContentType="application/xml"/>'+
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'+
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'+
    normalized.map((_,i)=>'<Override PartName="/xl/worksheets/sheet'+(i+1)+'.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join("")+
    '</Types>';

  const rootRels='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'+
    '</Relationships>';

  const workbook='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'+
    '<sheets>'+normalized.map((sheet,i)=>'<sheet name="'+xmlEscape(sheet.name)+'" sheetId="'+(i+1)+'" r:id="rId'+(i+1)+'"/>').join("")+'</sheets>'+
    '</workbook>';

  const workbookRels='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+
    normalized.map((_,i)=>'<Relationship Id="rId'+(i+1)+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet'+(i+1)+'.xml"/>').join("")+
    '<Relationship Id="rId'+(normalized.length+1)+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'+
    '</Relationships>';

  const styles='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'+
    '<fonts count="2"><font><sz val="11"/><name val="Calibri"/><family val="2"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/><family val="2"/></font></fonts>'+
    '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1E40AF"/><bgColor indexed="64"/></patternFill></fill></fills>'+
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'+
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'+
    '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf></cellXfs>'+
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'+
    '</styleSheet>';

  const entries=[
    {name:"[Content_Types].xml",data:contentTypes},
    {name:"_rels/.rels",data:rootRels},
    {name:"xl/workbook.xml",data:workbook},
    {name:"xl/_rels/workbook.xml.rels",data:workbookRels},
    {name:"xl/styles.xml",data:styles},
    ...normalized.map((sheet,i)=>({name:"xl/worksheets/sheet"+(i+1)+".xml",data:worksheetXml(sheet)}))
  ];
  return zipStore(entries);
}

export default createXlsxWorkbook;
