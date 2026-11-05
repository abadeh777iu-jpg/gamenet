const asset = (name) => `https://weekendcafe.top/images/${name}`;
const categories = [
  ['همه‌ی منو', '', '✳'],
  ['نوشیدنی گرم', 'coffee_cup_mf6awim4s0.png', '☕'],
  ['نوشیدنی سرد', 'cappuccino_ulbupFBDVK.png', '🧋'],
  ['شیک', 'milkshake_1_MfbUwZvneC.png', '🥤'],
  ['کیک', 'pudding_1_qBkaPzWNia.png', '🍰'],
  ['پیتزا', 'pizza_1_OXxEmRgxGk.png', '🍕'],
  ['سالاد', 'salad_yrfKUZbNPu.png', '🥗'],
  ['پاستا', 'spaghetti_ldBkS1vS7n.png', '🍝'],
  ['ساندویچ', 'sandwich_oN1Q5ogcIi.png', '🥪'],
  ['برگر', 'cheeseburger_CoQeGh4UpX.png', '🍔'],
  ['سیب زمینی', 'french_fries_1_sURIe98xfx.png', '🍟'],
  ['هات بار', 'hot_chocolate_VYFF4CdisM.png', '☕'],
  ['چایی', 'sticker_xKPeGOmh08.webp', '🍵'],
  ['اسموتی', 'coconut_a49x8HrqWk.png', '🥥'],
  ['ماکتیل', 'juice_Gbj7vrDyhs.png', '🍹'],
  ['آبمیوه', 'lemonade_HoY1eB6pbz.png', '🍋'],
  ['استیک', 'steak_nuvA1lVMPe.png', '🥩'],
  ['صبحانه', 'breakfast_nwHMRSdQcb.png', '🍳'],
  ['نوشیدنی', 'energy_drink_fcdy24gdbz.png', '🥤'],
  ['دسر', '5347946_zudewl6ii1.png', '🍮'],
  ['سوپ', '3823394_mfa23mmwlk.png', '🍲'],
  ['پیش غذا', '1277756_z4sjqbggkx.png', '🥨']
];

// نمونه‌ای از انتخاب‌های کافه برای نمایش در نسخه‌ی بازسازی‌شده
const products = [
  { name:'رد جک', category:'نوشیدنی سرد', price:515, emoji:'🍹', description:'پیشنهاد باریستا؛ ترکیبی خنک و خوش‌عطر برای یک عصر پاییزی.', featured:true },
  { name:'آمریکانو', category:'نوشیدنی گرم', price:145, emoji:'☕', description:'اسپرسوی خوش‌عطر با آب داغ؛ ساده، دلنشین و همیشه به‌موقع.' },
  { name:'لاته', category:'نوشیدنی گرم', price:185, emoji:'☕', description:'اسپرسو و شیر بخارداده‌شده با بافتی نرم و لطیف.' },
  { name:'کاپوچینو', category:'نوشیدنی گرم', price:175, emoji:'☕', description:'یک فنجان کلاسیک با اسپرسو، شیر و فوم مخملی.' },
  { name:'هات چاکلت', category:'هات بار', price:190, emoji:'🍫', description:'شکلات گرم و غلیظ برای روزهای آرام و خنک.' },
  { name:'چای ماسالا', category:'چایی', price:165, emoji:'🍵', description:'چای معطر با ادویه‌های گرم و شیر.' },
  { name:'آیس لاته', category:'نوشیدنی سرد', price:195, emoji:'🧋', description:'اسپرسو و شیر خنک، روی یخ؛ انتخابی تازه و متعادل.' },
  { name:'شیک شکلات', category:'شیک', price:225, emoji:'🥤', description:'شیک خنک و خامه‌ای با طعم دلنشین شکلات.' },
  { name:'چیزکیک روز', category:'کیک', price:210, emoji:'🍰', description:'برشی تازه و خوش‌طعم، مناسب کنار قهوه‌ی محبوبت.' },
  { name:'پیتزا مخصوص', category:'پیتزا', price:390, emoji:'🍕', description:'پیتزای تنوری و دلچسب برای یک دورهمی خوب.' },
  { name:'سالاد سزار', category:'سالاد', price:295, emoji:'🥗', description:'کاهوی تازه، مرغ گریل‌شده و سس سزار.' },
  { name:'پاستا آلفردو', category:'پاستا', price:350, emoji:'🍝', description:'پاستای گرم و خامه‌ای با مرغ و قارچ.' },
  { name:'ساندویچ مرغ', category:'ساندویچ', price:285, emoji:'🥪', description:'مرغ مزه‌دارشده با مخلفات تازه و نان برشته.' },
  { name:'برگر ویکند', category:'برگر', price:395, emoji:'🍔', description:'برگر آبدار با پنیر، سبزیجات تازه و سس مخصوص.' },
  { name:'سیب‌زمینی ویژه', category:'سیب زمینی', price:165, emoji:'🍟', description:'سیب‌زمینی طلایی و برشته برای همراهی با انتخابت.' },
  { name:'اسموتی توت‌فرنگی', category:'اسموتی', price:215, emoji:'🍓', description:'ترکیب خنک میوه‌های تازه با بافتی نرم و دلچسب.' },
  { name:'موهیتو', category:'ماکتیل', price:195, emoji:'🍹', description:'نعناع تازه، لیمو و خنکی دلچسب؛ بدون الکل.' },
  { name:'آب پرتقال تازه', category:'آبمیوه', price:175, emoji:'🍊', description:'آبمیوه‌ی تازه و طبیعی برای شروع یک روز خوب.' },
  { name:'صبحانه‌ی ویکند', category:'صبحانه', price:325, emoji:'🍳', description:'یک صبحانه‌ی کامل برای شروع آرام و خوشمزه‌ی روز.' },
  { name:'براونی شکلاتی', category:'دسر', price:185, emoji:'🍫', description:'براونی گرم و شکلاتی برای لحظه‌های شیرین.' },
  { name:'سوپ روز', category:'سوپ', price:175, emoji:'🍲', description:'سوپ گرم روز، تازه و مناسب روزهای خنک.' },
  { name:'استیک گریل', category:'استیک', price:690, emoji:'🥩', description:'استیک گریل‌شده با دورچین تازه.' },
  { name:'لیموناد', category:'نوشیدنی', price:165, emoji:'🍋', description:'ترکیبی خنک و ترش‌وشیرین برای رفع خستگی.' },
  { name:'نان سیر', category:'پیش غذا', price:145, emoji:'🥖', description:'پیش‌غذای گرم و خوش‌عطر، مناسب برای اشتراک.'}
];

const categoryWrap = document.querySelector('#menuCategories');
const grid = document.querySelector('#productGrid');
const search = document.querySelector('#menuSearch');
const count = document.querySelector('#resultCount');
const activeLabel = document.querySelector('#activeCategoryLabel');
const emptyState = document.querySelector('#emptyState');
const dialog = document.querySelector('#productDialog');
let selectedCategory = 'همه‌ی منو';

function renderCategories() {
  categoryWrap.innerHTML = categories.map(([name, image, emoji], index) => `
    <button class="category-pill${index === 0 ? ' active' : ''}" type="button" data-category="${name}">
      ${image ? `<img src="${asset(image)}" alt="" width="20" height="20" style="width:20px;height:20px;object-fit:contain;vertical-align:middle;margin-left:5px" onerror="this.replaceWith(document.createTextNode('${emoji}'))">` : `<span style="margin-left:5px">${emoji}</span>`}${name}
    </button>`).join('');
}
function priceLabel(product) {
  const amount = new Intl.NumberFormat('fa-IR').format(product.price);
  return product.unit ? `${amount} ${product.unit}` : amount;
}
function renderProducts() {
  const term = search.value.trim().toLocaleLowerCase('fa');
  const filtered = products.filter((product) =>
    (selectedCategory === 'همه‌ی منو' || product.category === selectedCategory) &&
    `${product.name} ${product.category} ${product.description}`.toLocaleLowerCase('fa').includes(term)
  );
  activeLabel.textContent = selectedCategory;
  count.textContent = `${new Intl.NumberFormat('fa-IR').format(filtered.length)} انتخاب`;
  grid.innerHTML = filtered.map((product) => `
    <article class="product-card" tabindex="0" role="button" aria-label="جزئیات ${product.name}" data-product="${product.name}">
      <div class="product-visual">${product.featured ? `<img src="${asset('img_c448_b6_f19_b28_9_pls9r8j607.png')}" alt="" onerror="this.replaceWith(document.createTextNode('${product.emoji}'))">` : `<img src="${asset(categories.find(([category]) => category === product.category)?.[1] || '')}" alt="" onerror="this.replaceWith(document.createTextNode('${product.emoji}'))">`}</div>
      <span class="product-category">${product.category}</span>
      <h3 class="product-name">${product.name}</h3>
      <div class="product-bottom"><span class="product-price">${priceLabel(product)} <small>تومان</small></span><span class="product-arrow">↗</span></div>
    </article>`).join('');
  emptyState.hidden = filtered.length > 0;
  grid.hidden = filtered.length === 0;
}
function showProduct(name) {
  const product = products.find((item) => item.name === name) || products[0];
  document.querySelector('#dialogName').textContent = product.name;
  document.querySelector('#dialogCategory').textContent = product.featured ? 'پیشنهاد باریستا' : product.category;
  document.querySelector('#dialogDescription').textContent = product.description;
  document.querySelector('#dialogPrice').textContent = `${priceLabel(product)} تومان`;
  const image = document.querySelector('#dialogImage');
  const fallback = document.querySelector('#dialogFallback');
  image.src = product.featured ? asset('img_c448_b6_f19_b28_9_pls9r8j607.png') : '';
  image.alt = product.name;
  image.style.display = product.featured ? '' : 'none';
  fallback.textContent = product.emoji;
  fallback.style.display = product.featured ? 'none' : 'block';
  if (!dialog.open) dialog.showModal();
}
renderCategories();
renderProducts();
categoryWrap.addEventListener('click', (event) => {
  const button = event.target.closest('[data-category]');
  if (!button) return;
  selectedCategory = button.dataset.category;
  categoryWrap.querySelector('.active')?.classList.remove('active');
  button.classList.add('active');
  renderProducts();
});
search.addEventListener('input', renderProducts);
grid.addEventListener('click', (event) => {
  const card = event.target.closest('[data-product]');
  if (card) showProduct(card.dataset.product);
});
grid.addEventListener('keydown', (event) => {
  if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('[data-product]')) {
    event.preventDefault(); showProduct(event.target.dataset.product);
  }
});
document.querySelector('.feature-open').addEventListener('click', () => showProduct('رد جک'));
document.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
