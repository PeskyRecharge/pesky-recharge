/**
 * PeskyRecharge - Senior Admin Telemetry Controller
 * Connects to Supabase 'customers' table and formats all schema attributes.
 */

const SUPABASE_URL = "https://beyykzogvaemjvecbzkf.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_JDxS16gwlyg9SxF0T2owYg_KKZqE9Gy";

// Initialize Supabase Client
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Application State
let customersList = [];
let currentFilter = 'all';
let searchQuery = '';

// DOM Elements Cache
const tableBody = document.getElementById('users-table-body');
const totalUsersEl = document.getElementById('total-users-count');
const onlineUsersEl = document.getElementById('online-users-count');
const offlineUsersEl = document.getElementById('offline-users-count');
const totalBalanceEl = document.getElementById('total-balance');
const connectionStatusEl = document.getElementById('connection-status');
const pulseDotEl = document.querySelector('.pulse-dot');
const searchInput = document.getElementById('search-input');
const filterBtns = document.querySelectorAll('.filter-btn');

// Bootstrap Application on Load
document.addEventListener('DOMContentLoaded', async () => {
    await fetchCustomersData();
    setupRealtimeWebSockets();
    setupEventListeners();
});

/**
 * Fetch all records from the 'customers' table in Supabase
 */
async function fetchCustomersData() {
    try {
        const { data, error } = await supabaseClient
            .from('customers')
            .select('*')
            .order('last_login', { ascending: false, nullsFirst: false });

        if (error) throw error;

        customersList = data || [];
        updateMetricsAndRender();
        
        connectionStatusEl.textContent = "Live Stream Active";
        pulseDotEl.classList.add('online');
    } catch (err) {
        console.error("Telemetry fetch exception:", err.message);
        connectionStatusEl.textContent = "Connection Failed";
        tableBody.innerHTML = `<tr><td colspan="8" class="empty-text">Error loading records: ${err.message}</td></tr>`;
    }
}

/**
 * Professional Date Formatter (e.g., "Today, 10:30 AM", "Yesterday, 8:15 PM", or absolute date)
 */
function formatFriendlyDate(timestampString) {
    if (!timestampString) return 'No activity recorded';
    
    const date = new Date(timestampString);
    if (isNaN(date.getTime())) return 'Invalid timestamp';

    const now = new Date();
    
    // Time formatting helper (e.g., 10:30 AM)
    const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    // Check if it's Today
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
        return `Today, ${timeString}`;
    }

    // Check if it's Yesterday
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();
    if (isYesterday) {
        return `Yesterday, ${timeString}`;
    }

    // Otherwise return standard formatted date with time
    const options = { month: 'short', day: 'numeric', year: 'numeric' };
    return `${date.toLocaleDateString([], options)}, ${timeString}`;
}

/**
 * Determines if a customer is online (Active session within the past 5 minutes)
 */
function isCustomerOnline(lastLoginTimestamp) {
    if (!lastLoginTimestamp) return false;
    const lastActiveTime = new Date(lastLoginTimestamp).getTime();
    const currentTime = new Date().getTime();
    const diffMinutes = (currentTime - lastActiveTime) / (1000 * 60);
    return diffMinutes <= 5;
}

/**
 * Computes dashboard metric counters and total wallet balances
 */
function updateMetricsAndRender() {
    const total = customersList.length;
    const online = customersList.filter(c => isCustomerOnline(c.last_login)).length;
    const offline = total - online;
    
    // Calculate sum of all customer balances
    const totalBalance = customersList.reduce((acc, curr) => acc + (Number(curr.balance) || 0), 0);

    totalUsersEl.textContent = total;
    onlineUsersEl.textContent = online;
    offlineUsersEl.textContent = offline;
    totalBalanceEl.textContent = `₦${totalBalance.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    renderTable();
}

/**
 * Renders filtered customer rows into the HTML table
 */
function renderTable() {
    const filtered = customersList.filter(customer => {
        const surname = (customer.surname || '').toLowerCase();
        const otherName = (customer.other_name || '').toLowerCase();
        const email = (customer.email || '').toLowerCase();
        const phone = (customer.phone_number || '').toLowerCase();
        const query = searchQuery.toLowerCase();
        
        const matchesSearch = surname.includes(query) || 
                              otherName.includes(query) || 
                              email.includes(query) || 
                              phone.includes(query);
                              
        const onlineStatus = isCustomerOnline(customer.last_login);

        if (currentFilter === 'online') return matchesSearch && onlineStatus;
        if (currentFilter === 'offline') return matchesSearch && !onlineStatus;
        return matchesSearch;
    });

    if (filtered.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="8" class="empty-text">No matching customer records found.</td></tr>`;
        return;
    }

    tableBody.innerHTML = filtered.map(customer => {
        const online = isCustomerOnline(customer.last_login);
        const statusClass = online ? 'online' : 'offline';
        const statusLabel = online ? 'Online' : 'Offline';
        
        // Full Name compilation from surname & other_name
        const fullName = [customer.surname, customer.other_name].filter(Boolean).join(' ') || 'Unnamed Customer';
        
        const friendlyLastLogin = formatFriendlyDate(customer.last_login);
        const joinedDate = customer.created_at ? new Date(customer.created_at).toLocaleDateString() : 'N/A';
        const phoneNum = customer.phone_number || 'N/A';
        const emailAddress = customer.email || 'N/A';
        const genderVal = customer.gender ? `<span class="badge-gender">${customer.gender}</span>` : '<span class="text-gray">N/A</span>';
        
        const formattedBalance = `₦${(Number(customer.balance) || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

        return `
            <tr>
                <td>
                    <div class="status-cell">
                        <span class="status-indicator ${statusClass}"></span>
                        <span>${statusLabel}</span>
                    </div>
                </td>
                <td><strong>${fullName}</strong></td>
                <td>${emailAddress}</td>
                <td>${phoneNum}</td>
                <td>${genderVal}</td>
                <td><strong>${formattedBalance}</strong></td>
                <td>${friendlyLastLogin}</td>
                <td>${joinedDate}</td>
            </tr>
        `;
    }).join('');
}

/**
 * Supabase Realtime WebSocket Listener for instant table sync
 */
function setupRealtimeWebSockets() {
    supabaseClient
        .channel('public:customers_live')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, payload => {
            console.log('Realtime sync event triggered:', payload);
            fetchCustomersData();
        })
        .subscribe();
}

/**
 * Event bindings for live search and filter tabs
 */
function setupEventListeners() {
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        renderTable();
    });

    filterBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            filterBtns.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentFilter = e.target.getAttribute('data-filter');
            renderTable();
        });
    });
}