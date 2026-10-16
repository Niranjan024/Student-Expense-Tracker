const $ = (id) => document.getElementById(id);
const COLORS = ["#8974f7", "#68b7f5", "#ffb86b", "#f37db5", "#46b6a2", "#a8c95b", "#f07865", "#9aa8bd"];
const CATEGORY_META = {
  Food: { icon: "☕", color: "#ffb86b" }, Travel: { icon: "🚌", color: "#68b7f5" },
  Education: { icon: "📚", color: "#8974f7" }, Shopping: { icon: "🛍️", color: "#f37db5" },
  Entertainment: { icon: "🎧", color: "#46b6a2" }, Bills: { icon: "🧾", color: "#9aa8bd" },
  Health: { icon: "💊", color: "#f07865" }, Other: { icon: "✦", color: "#a8c95b" },
  Allowance: { icon: "💸", color: "#46b6a2" }, "Part-time job": { icon: "💼", color: "#68b7f5" }, Gift: { icon: "🎁", color: "#f37db5" }
};
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
};
const monthISO = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}`;
const money = (amount) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(amount) || 0);
const escapeHTML = (value) => String(value).replace(/[&<>"']/g, ch => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[ch]));

let transactions = loadTransactions();
let budgets = loadBudgets();
let activeView = "overview";
let toastTimer;

function loadTransactions() {
  try {
    const saved = JSON.parse(localStorage.getItem("pocketwise_transactions"));
    return Array.isArray(saved) ? saved.filter(t => t && typeof t.id === "string" && typeof t.description === "string" && Number.isFinite(Number(t.amount)) && t.date) : [];
  } catch { return []; }
}
function loadBudgets() {
  try {
    const saved = JSON.parse(localStorage.getItem("pocketwise_budgets"));
    return saved && typeof saved === "object" ? saved : {};
  } catch { return {}; }
}
function saveData() {
  localStorage.setItem("pocketwise_transactions", JSON.stringify(transactions));
  localStorage.setItem("pocketwise_budgets", JSON.stringify(budgets));
}
function selectedMonth() { return $("monthFilter").value || monthISO(); }
function budgetFor(month = selectedMonth()) { return Number(budgets[month]) > 0 ? Number(budgets[month]) : 5000; }
function monthTransactions(month = selectedMonth()) { return transactions.filter(t => t.date.startsWith(month)); }
function expenses(list) { return list.filter(t => t.type === "Expense"); }
function total(list, type = "Expense") { return list.filter(t => t.type === type).reduce((sum, t) => sum + Number(t.amount), 0); }
function formatDate(date) {
  const d = new Date(`${date}T00:00:00`);
  return Number.isNaN(d.getTime()) ? date : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
function showToast(message) {
  $("toast").textContent = message;
  $("toast").classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("toast").classList.remove("show"), 2600);
}
function getGreeting() {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}
function render() {
  const month = selectedMonth();
  const list = monthTransactions(month);
  const spent = total(list);
  const budget = budgetFor(month);
  const remaining = budget - spent;
  const days = new Date(Number(month.slice(0,4)), Number(month.slice(5,7)), 0).getDate();
  $("pageTitle").innerHTML = `${getGreeting()}<span class="wave"> ✦</span>`;
  $("todayLabel").textContent = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" }).toUpperCase();
  $("monthSpend").textContent = money(spent);
  $("transactionCount").textContent = `${list.length} transaction${list.length === 1 ? "" : "s"} this month`;
  $("budgetAmount").textContent = money(budget);
  $("budgetRemaining").textContent = `${money(Math.max(remaining, 0))} remaining`;
  $("budgetProgress").style.width = `${Math.min(spent / budget * 100, 100)}%`;
  $("budgetProgress").style.background = spent > budget ? "#ef6565" : "#8974f7";
  $("dailyAverage").textContent = money(spent / Math.max(1, Math.min(new Date().getDate(), days)));
  $("budgetLeftPercent").textContent = `${Math.round((remaining / budget) * 100)}%`;
  $("budgetLeftPercent").style.color = remaining < 0 ? "#e45858" : "#2d9c70";
  $("budgetLeftNote").textContent = remaining < 0 ? `${money(Math.abs(remaining))} over budget` : "You’re within your limit";
  $("donutTotal").textContent = money(spent);
  renderDonut(expenses(list));
  renderInsights(list, spent, budget, remaining);
  renderRecent();
  renderAll();
  renderBudgetPage(list, spent, budget, remaining);
  populateCategoryFilter();
}
function renderDonut(list) {
  const sums = {};
  list.forEach(t => sums[t.category] = (sums[t.category] || 0) + Number(t.amount));
  const entries = Object.entries(sums).sort((a,b) => b[1]-a[1]);
  const sum = entries.reduce((n, e) => n + e[1], 0);
  let cursor = 0;
  const segments = entries.map(([category, amount], i) => {
    const start = cursor; cursor += sum ? amount / sum * 100 : 0;
    return `${CATEGORY_META[category]?.color || COLORS[i % COLORS.length]} ${start}% ${cursor}%`;
  });
  $("donutChart").style.background = sum ? `conic-gradient(${segments.join(",")})` : "#e9edf4";
  $("categoryCount").textContent = `${entries.length} categor${entries.length === 1 ? "y" : "ies"}`;
  $("categoryLegend").innerHTML = entries.length ? entries.slice(0,6).map(([category, amount], i) => `
    <div class="legend-item"><span class="legend-dot" style="background:${CATEGORY_META[category]?.color || COLORS[i%COLORS.length]}"></span>
    <span class="legend-name">${escapeHTML(category)}</span><span class="legend-value">${Math.round(amount / sum * 100)}%</span></div>`).join("") : '<div class="empty-state">Add an expense to see your spending breakdown.</div>';
}
function renderInsights(list, spent, budget, remaining) {
  const expenseList = expenses(list);
  const byCategory = {};
  expenseList.forEach(t => byCategory[t.category] = (byCategory[t.category] || 0) + Number(t.amount));
  const top = Object.entries(byCategory).sort((a,b)=>b[1]-a[1])[0];
  const income = total(list, "Income");
  const items = [];
  if (!list.length) {
    items.push(["✦", "Start with one entry", "Add your first expense to discover your spending habits."]);
    items.push(["⌁", "Give every rupee a job", "Set a monthly budget that fits your student life."]);
  } else {
    if (top) items.push([CATEGORY_META[top[0]]?.icon || "✦", `${top[0]} is your top category`, `${money(top[1])} spent here — ${Math.round(top[1] / Math.max(spent,1) * 100)}% of this month's expenses.`]);
    if (remaining < 0) items.push(["⚠", "Budget needs attention", `You're ${money(Math.abs(remaining))} over your monthly limit. Review non-essential spending.`]);
    else if (remaining / budget < .2) items.push(["◷", "Take it a little slower", `Only ${money(remaining)} of your budget remains this month.`]);
    else items.push(["✓", "You're on track", `${Math.round(remaining / budget * 100)}% of your budget is still available.`]);
    if (income > 0) items.push(["↗", "Income logged", `You've recorded ${money(income)} in income this month.`]);
    else items.push(["◎", "Remember your income", "Add allowance, gifts or part-time earnings for a fuller picture."]);
  }
  $("insightsList").innerHTML = items.slice(0,3).map(([icon,title,desc]) => `<div class="insight"><span class="insight-icon">${icon}</span><div><strong>${escapeHTML(title)}</strong><p>${escapeHTML(desc)}</p></div></div>`).join("");
}
function categoryIcon(category) { return CATEGORY_META[category]?.icon || "✦"; }
function transactionRow(t, all = false) {
  const isIncome = t.type === "Income";
  const note = t.notes ? `<small>${escapeHTML(t.notes)}</small>` : "";
  return `<tr>
    <td><div class="details-cell"><span class="category-icon">${categoryIcon(t.category)}</span><span class="detail-text">${escapeHTML(t.description)}${note}</span></div></td>
    <td><span class="category-tag">${escapeHTML(t.category)}</span></td>
    <td>${formatDate(t.date)}</td>
    ${all ? `<td>${isIncome ? "Income" : "Expense"}</td>` : ""}
    <td class="amount-cell ${isIncome ? "income-amount" : ""}">${isIncome ? "+" : "−"}${money(t.amount)}</td>
    <td class="row-actions"><button class="icon-btn" data-edit="${escapeHTML(t.id)}" aria-label="Edit ${escapeHTML(t.description)}" title="Edit">✎</button><button class="icon-btn delete-btn" data-delete="${escapeHTML(t.id)}" aria-label="Delete ${escapeHTML(t.description)}" title="Delete">×</button></td>
  </tr>`;
}
function renderRecent() {
  const list = monthTransactions().sort((a,b) => b.date.localeCompare(a.date) || b.createdAt-a.createdAt).slice(0,5);
  $("recentTable").innerHTML = list.map(t => transactionRow(t)).join("");
  $("recentEmpty").classList.toggle("hidden", list.length > 0);
}
function renderAll() {
  const query = $("searchInput").value.trim().toLowerCase();
  const category = $("categoryFilter").value;
  const type = $("typeFilter").value;
  const list = transactions.filter(t => t.date.startsWith(selectedMonth()))
    .filter(t => !query || `${t.description} ${t.category} ${t.notes || ""}`.toLowerCase().includes(query))
    .filter(t => category === "all" || t.category === category)
    .filter(t => type === "all" || t.type === type)
    .sort((a,b) => b.date.localeCompare(a.date) || b.createdAt-a.createdAt);
  $("allTable").innerHTML = list.map(t => transactionRow(t, true)).join("");
  $("allEmpty").classList.toggle("hidden", list.length > 0);
}
function renderBudgetPage(list, spent, budget, remaining) {
  $("budgetPageTotal").textContent = money(budget);
  $("budgetPageSpent").textContent = money(spent);
  $("budgetPageRemaining").textContent = money(remaining);
  $("budgetPageProgress").style.width = `${Math.min(spent / budget * 100, 100)}%`;
  $("budgetPageProgress").style.background = spent > budget ? "#ef6565" : "#367b24";
  $("budgetCaption").textContent = spent === 0 ? "You're off to a fresh start. Every good plan starts somewhere." : remaining < 0 ? `You've crossed your limit by ${money(Math.abs(remaining))}. You can adjust your plan or slow down spending.` : `${Math.round(spent / budget * 100)}% used — ${money(remaining)} left for the rest of the month.`;
  const sums = {};
  expenses(list).forEach(t => sums[t.category] = (sums[t.category] || 0) + Number(t.amount));
  const entries = Object.entries(sums).sort((a,b)=>b[1]-a[1]);
  $("budgetCategories").innerHTML = entries.length ? entries.map(([category,amount],i) => `<div class="budget-category"><div class="budget-category-top"><span class="category-icon" style="background:${CATEGORY_META[category]?.color || COLORS[i%COLORS.length]}22">${categoryIcon(category)}</span><strong>${escapeHTML(category)}</strong><span>${money(amount)}</span></div><div class="tiny-track"><div style="width:${Math.min(amount/Math.max(spent,1)*100,100)}%;background:${CATEGORY_META[category]?.color || COLORS[i%COLORS.length]}"></div></div><small>${Math.round(amount/Math.max(spent,1)*100)}% of expenses</small></div>`).join("") : '<div class="empty-state">Your category breakdown will appear after you add expenses.</div>';
}
function populateCategoryFilter() {
  const select = $("categoryFilter");
  const current = select.value || "all";
  const categories = [...new Set(transactions.filter(t => t.date.startsWith(selectedMonth())).map(t=>t.category))].sort();
  select.innerHTML = '<option value="all">All categories</option>' + categories.map(c=>`<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`).join("");
  select.value = categories.includes(current) ? current : "all";
}
function openExpense(transaction = null) {
  $("expenseForm").reset();
  $("editId").value = transaction?.id || "";
  $("formTitle").textContent = transaction ? "Edit transaction" : "Add transaction";
  $("saveTransactionBtn").textContent = transaction ? "Update transaction" : "Save transaction";
  $("description").value = transaction?.description || "";
  $("amount").value = transaction?.amount || "";
  $("date").value = transaction?.date || todayISO();
  $("notes").value = transaction?.notes || "";
  const type = transaction?.type || "Expense";
  document.querySelector(`input[name="entryType"][value="${type}"]`).checked = true;
  updateCategoryOptions(transaction?.category || (type === "Income" ? "Allowance" : "Food"));
  $("formError").textContent = "";
  $("expenseDialog").showModal();
  $("description").focus();
}
function updateCategoryOptions(selected) {
  const type = document.querySelector('input[name="entryType"]:checked').value;
  const expenseCats = ["Food","Travel","Education","Shopping","Entertainment","Bills","Health","Other"];
  const incomeCats = ["Allowance","Part-time job","Gift","Other"];
  const categories = type === "Income" ? incomeCats : expenseCats;
  $("category").innerHTML = categories.map(c=>`<option>${c}</option>`).join("");
  $("category").value = categories.includes(selected) ? selected : categories[0];
}
function openBudget() {
  $("budgetInput").value = budgetFor();
  $("budgetError").textContent = "";
  $("budgetDialog").showModal();
}
function switchView(view) {
  activeView = view;
  document.querySelectorAll(".nav-item").forEach(b=>b.classList.toggle("active", b.dataset.view === view));
  ["overview","transactions","budgets"].forEach(v => $(`${v}View`).classList.toggle("hidden", v !== view));
  $("pageTitle").innerHTML = ({overview:`${getGreeting()}<span class="wave"> ✦</span>`,transactions:"Your transactions",budgets:"Budget with intention"})[view];
  if(view === "transactions") renderAll();
}
function exportCSV() {
  const list = monthTransactions().slice().sort((a,b)=>a.date.localeCompare(b.date));
  if (!list.length) { showToast("No transactions to export for this month."); return; }
  const rows = [["Date","Description","Category","Type","Amount (INR)","Notes"], ...list.map(t=>[t.date,t.description,t.category,t.type,t.amount,t.notes||""])];
  const csv = rows.map(row=>row.map(value=>`"${String(value).replace(/"/g,'""')}"`).join(",")).join("\r\n");
  const blob = new Blob(["\uFEFF"+csv], {type:"text/csv;charset=utf-8;"});
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = `pocketwise-${selectedMonth()}.csv`; link.click();
  URL.revokeObjectURL(url);
  showToast("CSV export downloaded.");
}

$("monthFilter").value = monthISO();
$("year").textContent = new Date().getFullYear();
$("openAddBtn").addEventListener("click",()=>openExpense());
$("openAddBtn2").addEventListener("click",()=>openExpense());
$("closeExpense").addEventListener("click",()=>$("expenseDialog").close());
$("closeBudget").addEventListener("click",()=>$("budgetDialog").close());
$("editBudgetBtn").addEventListener("click",openBudget);
$("editBudgetBtn2").addEventListener("click",openBudget);
$("viewAllBtn").addEventListener("click",()=>switchView("transactions"));
$("exportBtn").addEventListener("click",exportCSV);
$("monthFilter").addEventListener("change",()=>{render();});
["searchInput","categoryFilter","typeFilter"].forEach(id=>$(id).addEventListener(id==="searchInput"?"input":"change",renderAll));
document.querySelectorAll(".nav-item").forEach(button=>button.addEventListener("click",()=>switchView(button.dataset.view)));
document.querySelectorAll('input[name="entryType"]').forEach(input=>input.addEventListener("change",()=>updateCategoryOptions()));

$("expenseForm").addEventListener("submit",event=>{
  event.preventDefault();
  const description = $("description").value.trim();
  const amount = Number($("amount").value);
  const date = $("date").value;
  const type = document.querySelector('input[name="entryType"]:checked').value;
  const category = $("category").value;
  if(description.length < 2) { $("formError").textContent = "Please enter a description with at least 2 characters."; $("description").focus(); return; }
  if(!Number.isFinite(amount) || amount <= 0 || amount > 10000000) { $("formError").textContent = "Enter an amount greater than ₹0 and no more than ₹1 crore."; $("amount").focus(); return; }
  if(!date || date > todayISO()) { $("formError").textContent = "Choose a valid date that is not in the future."; $("date").focus(); return; }
  const id = $("editId").value;
  const entry = {id:id || (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`),description,amount, date,type,category,notes:$("notes").value.trim(),createdAt:Date.now()};
  if(id) {
    const index = transactions.findIndex(t=>t.id===id);
    if(index >= 0) { entry.createdAt = transactions[index].createdAt || Date.now(); transactions[index] = entry; }
    showToast("Transaction updated.");
  } else {
    transactions.push(entry);
    showToast(type === "Income" ? "Income added. Nice!" : "Expense saved. You're in control.");
  }
  saveData();
  $("expenseDialog").close();
  render();
});
$("budgetForm").addEventListener("submit",event=>{
  event.preventDefault();
  const amount = Number($("budgetInput").value);
  if(!Number.isFinite(amount) || amount <= 0 || amount > 100000000) { $("budgetError").textContent = "Enter a budget between ₹1 and ₹10 crore."; return; }
  budgets[selectedMonth()] = amount;
  saveData(); $("budgetDialog").close(); render(); showToast("Monthly budget updated.");
});
document.addEventListener("click",event=>{
  const edit = event.target.closest("[data-edit]");
  const del = event.target.closest("[data-delete]");
  if(edit) {
    const transaction = transactions.find(t=>t.id===edit.dataset.edit);
    if(transaction) openExpense(transaction);
  }
  if(del) {
    const transaction = transactions.find(t=>t.id===del.dataset.delete);
    if(!transaction) return;
    if(confirm(`Delete "${transaction.description}"? This cannot be undone.`)) {
      transactions = transactions.filter(t=>t.id!==transaction.id);
      saveData(); render(); showToast("Transaction deleted.");
    }
  }
});
window.addEventListener("storage",event=>{
  if(event.key==="pocketwise_transactions" || event.key==="pocketwise_budgets") {
    transactions=loadTransactions(); budgets=loadBudgets(); render();
  }
});
render();
