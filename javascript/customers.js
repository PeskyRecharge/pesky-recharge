const supabaseUrl = "https://beyykzogvaemjvecbzkf.supabase.co";
const supabaseKey = "sb_publishable_JDxS16gwlyg9SxF0T2owYg_KKZqE9Gy";
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

const tbody = document.querySelector("#customersTable tbody");
const searchInput = document.getElementById("searchInput");
let allCustomers = [];

async function loadCustomers() {
  //  Fetch ALL customers, no filter by auth.uid()
  const { data, error } = await supabaseClient
    .from("customers")
    .select("*"); 

  if (error) {
    console.error("Error loading customers:", error);
    return;
  }

  allCustomers = data;
  renderCustomers(allCustomers);
}
function renderCustomers(customers) {
  tbody.innerHTML = "";
  customers.forEach((cust, index) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${index + 1}</td>
      <td>${cust.id || ""}</td>
      <td>${cust.auth_id || ""}</td>
      <td>${cust.surname || ""}</td>
      <td>${cust.other_name || ""}</td>
      <td>${cust.phone_number || ""}</td>   <!-- ✅ fixed -->
      <td>${cust.gender || ""}</td>
      <td>${cust.email || ""}</td>
      <td>${cust.balance || 0}</td>
    `;
    tbody.appendChild(tr);
  });
}

//  Search filter
searchInput.addEventListener("input", () => {
  const term = searchInput.value.toLowerCase();
  const filtered = allCustomers.filter(cust =>
    (cust.surname && cust.surname.toLowerCase().includes(term)) ||
    (cust.other_name && cust.other_name.toLowerCase().includes(term)) ||
    (cust.phone && cust.phone.toLowerCase().includes(term)) ||
    (cust.email && cust.email.toLowerCase().includes(term))
  );
  renderCustomers(filtered);
});

// Initialize
loadCustomers();

