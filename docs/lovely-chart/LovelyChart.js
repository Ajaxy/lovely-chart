(function(){var P=Math.pow,Q=Math.PI,R=Math.max,S=Math.min,T=Math.ceil,U=Math.round,V=Math.floor;function a(a,b,c){function d(a,b,c,d,f,h=1,i=null,j=!1){const k=D(c),l=T(d/k)*k,m=V(f/k)*k;e.font=ba,e.textAlign=j?"right":"left",e.textBaseline="bottom",j||(e.strokeStyle=L(a,"yAxisRulers",h),e.lineWidth=1),e.beginPath();for(let n=l;n<=m;n+=k){const[,c]=b.toPixels(0,n),d=G(h,c);e.fillStyle=i?N(i,d):L(a,"axesText",d),j?e.fillText(z(n),g.width-Z,c-Z/2):(e.fillText(z(n),Z,c-Z/2),e.moveTo(Z,c),e.lineTo(g.width-Z,c))}e.stroke()}const e=a,f=b,g=c;return{drawXAxis:function(a,b){e.clearRect(0,g.height-ea,c.width,ea);const d=g.height-ea/2,h=V(a.xAxisScale),j=B(h),k=1-(a.xAxisScale-h);e.font=ba,e.textAlign="center",e.textBaseline="middle";for(let c=a.labelFromIndex;c<=a.labelToIndex;c++){const h=c-fa;if(0!=h%j)continue;const i=f.xLabels[c],[l]=b.toPixels(c,0);let m=0==h%(2*j)?1:k;m=F(m,l,g.width),e.fillStyle=L(a,"axesText",m),e.fillText(i.text,l,d)}},drawYAxis:function(a,b,c){const{yAxisScale:e,yAxisScaleFrom:g,yAxisScaleTo:h,yAxisScaleProgress:i=0}=a,j=c&&f.datasets[0].color;if(d(a,b,U(g||e),a.yMinViewport,a.yMaxViewport,1-i,j),0<i&&d(a,b,h,a.yMinViewport,a.yMaxViewport,i,j),c){const{yAxisScaleSecond:b,yAxisScaleSecondFrom:e,yAxisScaleSecondTo:g,yAxisScaleSecondProgress:h=0}=a,i=f.datasets[f.datasets.length-1].color;d(a,c,U(e||b),a.yMinViewportSecond,a.yMaxViewportSecond,1-h,i,!0),0<h&&d(a,c,g,a.yMinViewportSecond,a.yMaxViewportSecond,h,i,!0)}}}}function b(a,b,c){function d(a){i(a)&&(F=a,p(z,A),j(a))}function e(){y=document.createElement("div"),y.className="minimap",y.style.height=`${ha}px`,g(),h(),u.appendChild(y),B={width:z.offsetWidth,height:z.offsetHeight}}function f(){return{width:u.offsetWidth-2*ia,height:ha}}function g(){const{canvas:a,context:b}=o(y,f());z=a,A=b}function h(){C=document.createElement("div"),C.className="ruler",C.innerHTML=la,D=C.children[1],H(D,{onCapture:k,onDrag:l,draggingCursor:"grabbing"}),H(D.children[0],{onCapture:k,onDrag:m,draggingCursor:"ew-resize"}),H(D.children[1],{onCapture:k,onDrag:n,draggingCursor:"ew-resize"}),y.appendChild(C)}function i(a){if(!F)return!0;const b=v.datasets.map(({key:a})=>`opacity#${a}`);return b.push("yMaxMinimap"),b.some(b=>F[b]!==a[b])}function j(a={}){const b=q({xOffset:0,xWidth:v.xLabels.length-1,yMin:a.yMinMinimap,yMax:a.yMaxMinimap,availableWidth:B.width,availableHeight:B.height,yPadding:1});v.datasets.forEach(({key:c,color:d,values:e,hasOwnYAxis:f})=>{const g=f?b.copy({yMin:a.yMinMinimapSecond,yMax:a.yMaxMinimapSecond}):b,h={color:d,opacity:a[`opacity#${c}`],lineWidth:ja},i={from:0,to:e.length-1};r(A,e,g,h,i)})}function k(a){E=a.target.offsetLeft}function l(a,b,{dragOffsetX:c}){const d=z.offsetWidth,e=d-D.offsetWidth,f=R(0,S(E+c,e)),g=f+D.offsetWidth;s({begin:f/d,end:g/d})}function m(a,b,{dragOffsetX:c}){const d=z.offsetWidth,e=D.offsetLeft+D.offsetWidth-2*ka,f=S(e,R(0,E+c));s({begin:f/d})}function n(a,b,{dragOffsetX:c}){const d=z.offsetWidth,e=D.offsetLeft+2*ka,f=R(e,S(E+ka+c,d));s({end:f/d})}function s(a){const b=Object.assign({},G,a);b.begin===G.begin&&b.end===G.end||(G=b,J(),x(G),I&&(clearTimeout(I),I=null),I=setTimeout(()=>{x(G)},50))}function t(){const{begin:a,end:b}=G;C.children[0].style.width=`${100*a}%`,C.children[1].style.width=`${100*(b-a)}%`,C.children[2].style.width=`${100*(1-b)}%`}const u=a,v=b,x=c;let y,z,A,B,C,D,E,F,G={},I=null;const J=w(t);return e(),s(Y),{update:d}}function c(a,b,c){function e({range:a={},filter:b={}}={}){Object.assign(j,a),Object.assign(k,b);const c=p;p=d(g,h,j,k,c),m.forEach(a=>{const b=n.get(a),d=b?b.to:c[a];if(d!==void 0&&d!==p[a]){const d=b?b.current:c[a];b&&n.remove(a),n.add(a,d,p[a])}}),n.isRunning()||o()}function f(){i(v(p,n.getState()))}const g=a,h=b,i=c,j={begin:0,end:1},k=function(){const a={};return g.datasets.forEach(({key:b})=>{a[b]=!0}),a}(),m=function(){return u([ua,g.datasets.map(({key:a})=>`opacity#${a}`)])}(),n=l(f),o=w(f);let p={};return{update:e}}function d(a,b,c,d,h){const{begin:i,end:j}=c,k=a.xLabels.length-1,l=R(0,T(k*i)),m=S(V(k*j),k),n=f(a.xLabels.length,b.width,i,j),o=e(a,d,l,m,h),p=g(b.height,o.yMinViewport,o.yMaxViewport),q=a.hasSecondYAxis&&g(b.height,o.yMinViewportSecond,o.yMaxViewportSecond),r={};return a.datasets.forEach(({key:a})=>{r[`opacity#${a}`]=d[a]?1:0}),Object.assign({xOffset:i*k,xWidth:(j-i)*k,xAxisScale:n,yAxisScale:p,yAxisScaleSecond:q,labelFromIndex:R(0,l-1),labelToIndex:S(m+1,k),filter:d},o,r,J(),c)}function e(a,b,c,d,e){const f=a.hasSecondYAxis&&a.datasets.slice(-1)[0],g=a.datasets.filter(a=>b[a.key]&&a!==f),h=g.map(({values:a})=>a),i=h.map(a=>a.slice(c,d+1)),{min:j=e.yMinMinimap,max:k=e.yMaxMinimap}=s(u(h)),l=j/k>ga?j:0,{min:m=e.yMinViewport,max:n=e.yMaxViewport}=s(u(i)),o=j/k>ga?m:0;let p=null,q=null,r=null,t=null;if(f&&b[f.key]){const a=s(f.values),b=a.min||e.yMinMinimapSecond;t=a.max||e.yMaxMinimapSecond,r=b/t>ga?b:0;const g=s(f.values.slice(c,d+1)),h=g.min||e.yMinViewportSecond;q=g.max||e.yMaxViewportSecond,p=b/t>ga?h:0}return{yMinViewport:o,yMaxViewport:n,yMinMinimap:l,yMaxMinimap:k,yMinViewportSecond:p,yMaxViewportSecond:q,yMinMinimapSecond:r,yMaxMinimapSecond:t}}function f(a,b,c,d){const e=V(b/ca);return C(a*(d-c)/e)}function g(a,b,c){const d=V((a-ea)/da);return E((c-b)/d)}function h(a,b,c){function d(){i=document.createElement("div"),i.className="tools",g.datasets.forEach(({key:a,name:b,color:c})=>{const d=document.createElement("a");d.href="#",d.dataset.key=a,d.className="checkbox checked",d.innerHTML=`<span class="circle"></span><span class="label">${b}</span>`,d.firstChild.style.borderColor=c,d.addEventListener("click",e),i.appendChild(d)}),f.appendChild(i)}function e(a){a&&(a.preventDefault(),a.currentTarget.classList.toggle("checked"));const b={};Array.from(i.getElementsByTagName("a")).forEach(a=>{b[a.dataset.key]=a.classList.contains("checked")}),h(b)}const f=a,g=b,h=c;let i;d(),e()}function i(a,b,c){function d(){x=document.createElement("div"),x.className="tooltip",e(),f(),x.addEventListener("mousemove",g),x.addEventListener("touchmove",g),x.addEventListener("touchstart",g),x.addEventListener("mouseout",h),x.addEventListener("mouseup",h),x.addEventListener("touchend",h),x.addEventListener("touchcancel",h),q.appendChild(x)}function e(){const{canvas:a,context:b}=o(x,s);y=a,A=b}function f(){B=document.createElement("div"),B.className="balloon",B.innerHTML="<div class=\"title\"></div><div class=\"legend\"></div>",x.appendChild(B)}function g(a){C=a.type.startsWith("touch")?a.touches[0].pageX-j(a.touches[0].target):a.offsetX,D()}function h(a){a&&a.preventDefault(),C=null,p(y,A),n()}function i(){if(!C||!t)return;const a=C,b=t,c=u.findClosesLabelIndex(a);if(!(0>c||c>=r.xLabels.length)){p(y,A);const[a]=u.toPixels(c,0);l(a,s.height-ea,L(b,"tooltipTail"));const d=r.datasets.filter(({key:a})=>b.filter[a]).map(({name:a,color:b,values:d,hasOwnYAxis:e})=>({name:a,color:b,value:d[c],hasOwnYAxis:e}));d.forEach(({value:a,color:d,hasOwnYAxis:e})=>{const f=e?v:u;k(f.toPixels(c,a),d,L(b,"bg"))}),m(d,a,c)}}function k([a,b],c,d){A.strokeStyle=c,A.fillStyle=d,A.lineWidth=2,A.beginPath(),A.arc(a,b,4,0,2*Q),A.fill(),A.stroke()}function l(a,b,c){A.strokeStyle=c,A.lineWidth=1,A.beginPath(),A.moveTo(a,0),A.lineTo(a,b),A.stroke()}function m(a,b,c){const d=r.xLabels[c],e=new Date(d.value);B.children[0].innerHTML=`${pa[e.getDay()]}, ${d.text}`,B.children[1].innerHTML=a.map(({name:a,color:b,value:c})=>`<div class="dataset" style="color: ${b}"><div>${z(c,2)}</div><div>${a}</div></div>`).join("");const f=R(qa+W,S(b,s.width-(B.offsetWidth+W)+qa));B.style.left=`${f}px`,B.classList.add("shown")}function n(){B.classList.remove("shown")}const q=a,r=b,s=c;let t,u,v,x,y,A,B,C;const D=w(i);return d(),{update:function(a,b,c){t=a,u=b,v=c,i()}}}function j(a){return a.getBoundingClientRect().left}function k(a){return Math.sin(Q/2*a)}function l(a){function b(a,b,c){g[a]={from:b,to:c,current:b,startedAt:Date.now(),progress:0},h||(h=requestAnimationFrame(e))}function c(a){delete g[a],d()||(cancelAnimationFrame(h),h=null)}function d(){return!!Object.keys(g).length}function e(){const a={};Object.keys(g).forEach(b=>{const{startedAt:d,from:e,to:f}=g[b],h=S(1,(Date.now()-d)/ra),i=e+(f-e)*k(h);g[b].current=i,g[b].progress=h,a[b]=i,1===h&&c(b)}),f(a),d()&&(h=requestAnimationFrame(e))}const f=a,g={};let h=null;return{add:b,remove:c,get:function(a){return g[a]},getState:function(){const a={};return Object.keys(g).forEach(b=>{const{current:c,from:d,to:e,progress:f}=g[b];a[b]=c,a[`${b}From`]=d,a[`${b}To`]=e,a[`${b}Progress`]=f}),a},isRunning:d}}function m(a){const{columns:b,names:c,colors:d,y_scaled:e}=a;let f=[];const g=[];return b.forEach((a,h)=>{const i=a.shift();return i===X?(f=a,void t(f)):void g.push({key:i,color:d[i],name:c[i],values:a,hasOwnYAxis:e&&h===b.length-1})}),g.forEach(a=>{a.labels=f}),{datasets:g}}function n(a){const{datasets:b}=m(a);let c=1/0,d=-Infinity;b.forEach(a=>{const{max:b}=s(a.values),e=0;e<c&&(c=e),b>d&&(d=b),a.yMin=e,a.yMax=b});const e=b.map(a=>a.labels[0]),f=b.map(a=>a.labels[a.labels.length-1]),g=S.apply(null,e),h=R.apply(null,f),i=x(g,h);return{datasets:b,yMin:c,yMax:d,xLabels:i,hasSecondYAxis:a.y_scaled}}function o(a,{width:b,height:c}){const d=document.createElement("canvas");d.width=b*ma,d.height=c*ma,d.style.width="100%",d.style.height=`${c}px`;const e=d.getContext("2d");return e.scale(ma,ma),a.appendChild(d),{canvas:d,context:e}}function p(a,b){b.clearRect(0,0,a.width,a.height)}function q(a){const{begin:b,end:c,xWidth:d,xOffset:e,yMin:f,yMax:g,availableWidth:h,availableHeight:i,xPadding:j=0,yPadding:k=0}=a;let l=h;0===b&&(l-=j),1===c&&(l-=j);const m=l/d;let n=e*m;0===b&&(n-=j);const o=(i-k)/(g-f);return{toPixels(a,b){return[a*m-n,i-(b*o-f*o)]},findClosesLabelIndex(a){return U((a+n)/m)},copy(b){return q(v(a,b))}}}function r(a,b,c,d,e){a.beginPath();for(let f=e.from;f<=e.to;f++){const[d,g]=c.toPixels(f,b[f]);f===e.from?a.moveTo(d,g):a.lineTo(d,g)}a.save(),a.strokeStyle=d.color,a.lineWidth=d.lineWidth,a.globalAlpha=d.opacity,a.lineJoin="bevel",a.lineCap="butt",a.stroke(),a.restore()}function s(a){const b=a.length;let c=a[0],d=a[0];for(let e=0;e<b;e++){const b=a[e];b>c?c=b:b<d&&(d=b)}return{max:c,min:d}}function t(a){for(let b=0,c=a.length;b<c;b++)if(a[b]!==void 0&&a[b+1]!==void 0&&a[b]>=a[b+1])throw new Error("Array is not sorted")}function u(a){return[].concat.apply([],a)}function v(a,b){return new Proxy({},{get:(c,d)=>void 0===b[d]?a[d]:b[d]})}function w(a){let b=!1;return function(){b||(b=!0,requestAnimationFrame(()=>{b=!1,a()}))}}function x(a,b){a=y(a),b=y(b);const c=[];for(let d=a;d<=b;d+=na){const a=new Date(d),b=a.getDate(),e=oa[a.getMonth()];c.push({value:d,text:`${e} ${b}`})}return c}function y(a){return a-a%na}function z(a,b=1){if(1e6<=a)return A(a/1e6,b)+"M";return 1e3<=a?A(a/1e3,b)+"K":a}function A(a,b){return a.toFixed(b).replace(/(\d{3,})\.\d+/,"$1").replace(/\.0+$/,"")}function B(a){return P(2,a)}function C(a){return T(Math.log2(a))}function D(a){return 13>=a?2*P(a,2):(a%10||1)*P(10,V(a/10)+1)}function E(a){var b=Math.log10;return T(288>=a?Math.sqrt(a/2):10*V(b(a)-1)+a/P(10,V(b(a))))}function F(a,b,c){const d=S(b+Z,c-b);return 40>=d&&(a=S(1,a,d/40)),a}function G(a,b){return b-Z<=20?S(1,a,(b-Z)/20):a}function H(a,b){function c(c){c.target!==a||(c.preventDefault(),g=c,"mousedown"===c.type?(document.addEventListener("mousemove",f),document.addEventListener("mouseup",d)):"touchstart"===c.type&&(document.addEventListener("touchmove",f),document.addEventListener("touchend",d),document.addEventListener("touchcancel",d),c.pageX===void 0&&(c.pageX=c.touches[0].pageX)),b.draggingCursor&&document.body.classList.add(`cursor-${b.draggingCursor}`),b.onCapture&&b.onCapture(c))}function d(){g&&(b.draggingCursor&&document.body.classList.remove(`cursor-${b.draggingCursor}`),document.removeEventListener("mouseup",d),document.removeEventListener("mousemove",f),document.removeEventListener("touchcancel",d),document.removeEventListener("touchend",d),document.removeEventListener("touchmove",f),g=null)}function f(a){g&&("touchmove"===a.type&&a.pageX===void 0&&(a.pageX=a.touches[0].pageX),b.onDrag(a,g,{dragOffsetX:a.pageX-g.pageX}))}let g=null;a.addEventListener("mousedown",c),a.addEventListener("touchstart",c)}function I(){return document.body.classList.contains("skin-night")?"night":"day"}function J(a={}){const b={},c=sa[I()];return Object.keys(sa.day).forEach(d=>{K(b,d,a[d]||c[d])}),b}function K(a,b,c){["R","G","B"].forEach((d,e)=>{a[`colorChannels#${b}#${d}`]=c[e]})}function L(a,b,c=1){return O(M(a,b),c)}function M(a,b){return["R","G","B"].map(c=>U(a[`colorChannels#${b}#${c}`]))}function N(a,b){return a=a.replace("#",""),O([parseInt(a.slice(0,2),16),parseInt(a.slice(2,4),16),parseInt(a.slice(4,6),16)],b)}function O([c,d,e],b=1){return`rgba(${c}, ${d}, ${e}, ${b})`}window.LovelyChart={create:function(d,e){function f(){A.update()}function g(a){v=document.createElement("div"),v.className="lovely-chart";const b=document.getElementById(a);b.appendChild(v)}function j(){const{canvas:a,context:b}=o(v,{width:v.clientWidth,height:$});w=a,x=b,y={width:w.offsetWidth,height:w.offsetHeight}}function k(){z=a(x,u,y),A=c(u,y,l),B=b(v,u,s),C=i(v,u,y),h(v,u,t)}function l(a){const b=q({begin:a.begin,end:a.end,xOffset:a.xOffset,xWidth:a.xWidth,yMin:a.yMinViewport,yMax:a.yMaxViewport,availableWidth:y.width,availableHeight:y.height-ea,xPadding:Z,yPadding:_}),c=u.hasSecondYAxis&&b.copy({yMin:a.yMinViewportSecond,yMax:a.yMaxViewportSecond});p(w,x),z.drawYAxis(a,b,c),m(a,b,c),z.drawXAxis(a,b),B.update(a),C.update(a,b,c)}function m(a,b,c){const d={from:a.labelFromIndex,to:a.labelToIndex};u.datasets.forEach(({key:e,color:f,values:g,hasOwnYAxis:h})=>{const i=h?c:b,j={color:f,opacity:a[`opacity#${e}`],lineWidth:aa};r(x,g,i,j,d)})}function s(a){A.update({range:a})}function t(a){A.update({filter:a})}let u,v,w,x,y,z,A,B,C;return g(d),j(),function(a){const{dataSource:b}=a;return b?fetch(`${b}/overview.json`).then(a=>a.json()):Promise.resolve(a)}(e).then(a=>{u=n(a),k()}),{redraw:f}}};const W=1,X="x",Y={begin:.333,end:.667},Z=10,$=320,_=10,aa=2,ba="300 10px Helvetica, Arial, sans-serif",ca=45,da=50,ea=30,fa=1,ga=.1,ha=40,ia=10,ja=1,ka=5,la="<div class=\"mask\"></div><div class=\"slider\"><div></div><div></div></div><div class=\"mask\"></div>",ma=window.devicePixelRatio||1,na=86400000,oa=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],pa=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],qa=20,ra=300,sa={day:{bg:[255,255,255],axesText:[150,162,170],yAxisRulers:[242,244,245],tooltipTail:[223,230,235]},night:{bg:[36,47,62],axesText:[84,103,120],yAxisRulers:[41,53,68],tooltipTail:[59,74,90]}},ta=u(Object.keys(sa.day).map(a=>["R","G","B"].map(b=>`colorChannels#${a}#${b}`))),ua=["yMinViewport","yMaxViewport","yMinMinimap","yMaxMinimap","yMinViewportSecond","yMaxViewportSecond","yMinMinimapSecond","yMaxMinimapSecond","xAxisScale","yAxisScale","yAxisScaleSecond",...ta]})();