// ======================================
// SUPABASE SETUP
// ======================================

const supabaseUrl =
  "https://beyykzogvaemjvecbzkf.supabase.co";

const supabaseKey =
  "sb_publishable_JDxS16gwlyg9SxF0T2owYg_KKZqE9Gy";

const supabaseClient =
  supabase.createClient(
    supabaseUrl,
    supabaseKey
  );


// ======================================
// PAYSTACK
// ======================================

const paystackPublicKey =
  "pk_live_c9ee73e26b910173a36d5aac458801a53f667f26";


// ======================================
// DOM ELEMENTS
// ======================================

const depositBtn =
  document.getElementById("depositBtn");

const amountSection =
  document.getElementById("amountSection");

const confirmDepositBtn =
  document.getElementById("confirmDepositBtn");

const balanceEl =
  document.getElementById("balance");

const amountInput =
  document.getElementById("depositAmount");


// ======================================
// STATE
// ======================================

let currentUser = null;
let currentBalance = 0;


// ======================================
// GET LOGGED-IN USER
// ======================================

async function getUser() {

  try {

    const {
      data,
      error
    } =
      await supabaseClient.auth.getSession();


    if (error) {

      console.error(
        "Session error:",
        error
      );

      window.location.href =
        "login.html";

      return;
    }


    if (
      !data ||
      !data.session ||
      !data.session.user
    ) {

      console.log(
        "No active login session."
      );

      window.location.href =
        "login.html";

      return;
    }


    currentUser =
      data.session.user;


    console.log(
      "Logged-in user:",
      currentUser
    );


    await loadBalance();

  } catch (error) {

    console.error(
      "Get user error:",
      error
    );

    window.location.href =
      "login.html";

  }

}


// ======================================
// LOAD USER BALANCE
// ======================================

async function loadBalance() {

  if (!currentUser) {
    return;
  }


  try {

    const {
      data,
      error
    } =
      await supabaseClient
        .from("customers")
        .select("balance")
        .eq(
          "auth_id",
          currentUser.id
        )
        .single();


    if (error) {

      console.error(
        "Balance error:",
        error
      );

      currentBalance = 0;


      if (balanceEl) {

        balanceEl.textContent =
          "₦0.00";

      }

      return;
    }


    currentBalance =
      Number(
        data?.balance || 0
      );


    if (balanceEl) {

      balanceEl.textContent =
        `₦${currentBalance.toFixed(2)}`;

    }

  } catch (error) {

    console.error(
      "Load balance error:",
      error
    );

    currentBalance = 0;


    if (balanceEl) {

      balanceEl.textContent =
        "₦0.00";

    }

  }

}


// ======================================
// SHOW DEPOSIT AMOUNT SECTION
// ======================================

if (depositBtn) {

  depositBtn.addEventListener(
    "click",
    () => {

      depositBtn.classList.add(
        "hidden"
      );


      if (amountSection) {

        amountSection.classList.remove(
          "hidden"
        );

      }

    }
  );

}


// ======================================
// CONFIRM DEPOSIT
// ======================================

if (confirmDepositBtn) {

  confirmDepositBtn.addEventListener(
    "click",
    async () => {


      // ==================================
      // CHECK USER LOGIN
      // ==================================

      if (!currentUser) {

        alert(
          "Your login session is not ready. Please refresh the page."
        );

        return;
      }


      // ==================================
      // GET DEPOSIT AMOUNT
      // ==================================

      const amount =
        Number(
          amountInput?.value
        );


      // ==================================
      // VALIDATE AMOUNT
      // ==================================

      if (
        !Number.isFinite(amount) ||
        amount < 100
      ) {

        alert(
          "Minimum deposit is ₦100"
        );

        return;
      }


      // ==================================
      // DISABLE BUTTON
      // ==================================

      confirmDepositBtn.disabled =
        true;

      confirmDepositBtn.textContent =
        "Starting payment...";


      try {


        // ==================================
        // CHECK PAYSTACK LIBRARY
        // ==================================

        if (
          typeof PaystackPop ===
          "undefined"
        ) {

          throw new Error(
            "Paystack library was not loaded."
          );

        }


        // ==================================
        // LOG PAYMENT INFORMATION
        // ==================================

        console.log(
          "Starting Paystack payment..."
        );

        console.log(
          "User ID:",
          currentUser.id
        );

        console.log(
          "Email:",
          currentUser.email
        );

        console.log(
          "Amount:",
          amount
        );


        // ==================================
        // CREATE PAYSTACK INSTANCE
        // ==================================

        const paystack =
          new PaystackPop();


        // ==================================
        // START PAYSTACK V2 TRANSACTION
        // ==================================

        paystack.newTransaction({

          // --------------------------------
          // PUBLIC KEY
          // --------------------------------

          key:
            paystackPublicKey,


          // --------------------------------
          // CUSTOMER EMAIL
          // --------------------------------

          email:
            currentUser.email,


          // --------------------------------
          // AMOUNT
          // Paystack uses kobo
          // --------------------------------

          amount:
            Math.round(
              amount * 100
            ),


          // --------------------------------
          // CURRENCY
          // --------------------------------

          currency:
            "NGN",


          // ==================================
          // IMPORTANT:
          // SEND USER ID TO PAYSTACK
          // ==================================

          metadata: {

            userId:
              currentUser.id

          },


          // ==================================
          // PAYMENT SUCCESS
          // ==================================

          onSuccess:
            async (transaction) => {

              try {

                console.log(
                  "Paystack payment successful:",
                  transaction
                );


                // --------------------------------
                // GET PAYMENT REFERENCE
                // --------------------------------

                const reference =
                  transaction.reference;


                if (!reference) {

                  throw new Error(
                    "Paystack did not return a payment reference."
                  );

                }


                console.log(
                  "Payment reference:",
                  reference
                );


                // ==================================
                // VERIFY PAYMENT
                // ==================================

                console.log(
                  "Verifying payment..."
                );


                const verify =
                  await fetch(

                    `${supabaseUrl}/functions/v1/verify-payment`,

                    {

                      method:
                        "POST",


                      headers: {

                        "Content-Type":
                          "application/json"

                      },


                      body:
                        JSON.stringify({

                          reference:
                            reference,

                          userId:
                            currentUser.id,

                          amount:
                            amount

                        })

                    }

                  );


                // ==================================
                // CHECK SERVER RESPONSE
                // ==================================

                if (!verify.ok) {

                  throw new Error(

                    `Verification server returned ${verify.status}`

                  );

                }


                // ==================================
                // READ RESPONSE
                // ==================================

                const result =
                  await verify.json();


                console.log(
                  "Verification result:",
                  result
                );


                // ==================================
                // CHECK VERIFICATION
                // ==================================

                if (
                  !result ||
                  !result.success
                ) {

                  alert(

                    result?.message ||
                    "Payment verification failed."

                  );


                  confirmDepositBtn.disabled =
                    false;


                  confirmDepositBtn.textContent =
                    "Continue to Payment";


                  return;

                }


                // ==================================
                // REFRESH BALANCE
                // ==================================

                await loadBalance();
                
// ==========================================
// SHOW PROFESSIONAL SUCCESS MODAL
// ==========================================

function showDepositSuccess(amount, reference) {
  const modal = document.getElementById("depositSuccessModal");
  const amountEl = document.getElementById("successDepositAmount");
  const referenceEl = document.getElementById("successDepositReference");

  if (!modal) {
    console.error("Deposit success modal not found.");
    return;
  }

  if (amountEl) {
    amountEl.textContent = `₦${Number(amount).toLocaleString("en-NG", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  }

  if (referenceEl) {
    referenceEl.textContent = reference || "---";
  }

  modal.classList.remove("hidden");
}


// ==========================================
// CLOSE SUCCESS MODAL
// ==========================================

function closeDepositSuccess() {
  const modal = document.getElementById("depositSuccessModal");

  if (modal) {
    modal.classList.add("hidden");
  }

  window.location.href = "dashboard.html";
}


const closeDepositModal =
  document.getElementById("closeDepositModal");

const successDoneBtn =
  document.getElementById("successDoneBtn");


if (closeDepositModal) {
  closeDepositModal.addEventListener(
    "click",
    closeDepositSuccess
  );
}


if (successDoneBtn) {
  successDoneBtn.addEventListener(
    "click",
    closeDepositSuccess
  );
}


                // ==================================
                // GO TO DASHBOARD
                // ==================================

                window.location.href =
                  "dashboard.html";


              } catch (error) {

                console.error(
                  "Deposit verification error:",
                  error
                );


                alert(

                  "Payment was completed, but we could not verify it. Please contact support."

                );


                confirmDepositBtn.disabled =
                  false;


                confirmDepositBtn.textContent =
                  "Continue to Payment";

              }

            },


          // ==================================
          // PAYMENT CANCELLED
          // ==================================

          onCancel:
            () => {

              console.log(
                "Paystack payment cancelled or closed."
              );


              confirmDepositBtn.disabled =
                false;


              confirmDepositBtn.textContent =
                "Continue to Payment";

            },


          // ==================================
          // PAYMENT LOADED
          // ==================================

          onLoad:
            (response) => {

              console.log(
                "Paystack payment loaded:",
                response
              );

            },


          // ==================================
          // PAYSTACK ERROR
          // ==================================

          onError:
            (error) => {

              console.error(
                "Paystack transaction error:",
                error
              );


              alert(

                error?.message ||
                "Unable to start payment."

              );


              confirmDepositBtn.disabled =
                false;


              confirmDepositBtn.textContent =
                "Continue to Payment";

            }

        });


      } catch (error) {

        console.error(
          "Paystack error:",
          error
        );


        alert(

          error?.message ||
          "Unable to start payment."

        );


        confirmDepositBtn.disabled =
          false;


        confirmDepositBtn.textContent =
          "Continue to Payment";

      }

    }

  );

}


// ======================================
// AUTH STATE LISTENER
// ======================================

supabaseClient.auth.onAuthStateChange(

  (event, session) => {

    console.log(
      "Auth event:",
      event
    );


    if (
      event === "SIGNED_OUT"
    ) {

      currentUser =
        null;


      window.location.href =
        "login.html";

    }

  }

);


// ======================================
// START PAGE
// ======================================

getUser();
