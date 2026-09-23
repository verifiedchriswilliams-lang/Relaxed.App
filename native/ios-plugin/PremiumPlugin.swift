import Foundation
import Capacitor
import StoreKit

// Native StoreKit 2 bridge for the one-time "unlock all premium" purchase
// (the 9 premium soundscapes, the 10 premium voices, and infinite sessions).
//
// The web layer (lib/entitlement.ts) calls this through Capacitor.Plugins.Premium:
//   getEntitlement() -> { entitled }   // is the unlock owned on this Apple ID?
//   purchase()       -> { entitled }   // present the StoreKit sheet, then report
//   restore()        -> { entitled }   // AppStore.sync(), then report
// and listens for the "entitlementChanged" event (Ask-to-Buy approvals, purchases
// made on another device, refunds).
//
// Requires iOS 15+ (StoreKit 2). The app targets iOS 16.4+, so no extra guard.
@objc(PremiumPlugin)
public class PremiumPlugin: CAPPlugin {

    // MUST match the non-consumable product ID created in App Store Connect.
    private let productID = "app.relaxed.premium"

    private var updates: Task<Void, Never>?

    // Watch for transaction updates for the life of the app (deferred purchases,
    // family sharing, cross-device, revocations) and push the new state to JS.
    override public func load() {
        updates = Task.detached { [weak self] in
            guard let self = self else { return }
            for await update in Transaction.updates {
                if case .verified(let transaction) = update {
                    await transaction.finish()
                    let entitled = await PremiumPlugin.entitled(self.productID)
                    self.notifyListeners("entitlementChanged", data: ["entitled": entitled])
                }
            }
        }
    }

    deinit { updates?.cancel() }

    @objc func getEntitlement(_ call: CAPPluginCall) {
        Task {
            call.resolve(["entitled": await PremiumPlugin.entitled(productID)])
        }
    }

    @objc func purchase(_ call: CAPPluginCall) {
        Task {
            do {
                guard let product = try await Product.products(for: [productID]).first else {
                    call.reject("Product \(productID) not found. Check App Store Connect and the product ID.")
                    return
                }
                let result = try await product.purchase()
                switch result {
                case .success(let verification):
                    if case .verified(let transaction) = verification {
                        await transaction.finish()
                        call.resolve(["entitled": true])
                    } else {
                        call.reject("Purchase could not be verified.")
                    }
                case .userCancelled:
                    call.resolve(["entitled": await PremiumPlugin.entitled(productID), "cancelled": true])
                case .pending:
                    // Ask to Buy / SCA: resolves later via the updates listener.
                    call.resolve(["entitled": false, "pending": true])
                @unknown default:
                    call.resolve(["entitled": await PremiumPlugin.entitled(productID)])
                }
            } catch {
                call.reject(error.localizedDescription)
            }
        }
    }

    @objc func restore(_ call: CAPPluginCall) {
        Task {
            try? await AppStore.sync()
            call.resolve(["entitled": await PremiumPlugin.entitled(productID)])
        }
    }

    // The unlock is owned iff there's a verified, un-revoked entitlement for it.
    private static func entitled(_ productID: String) async -> Bool {
        for await result in Transaction.currentEntitlements {
            if case .verified(let t) = result, t.productID == productID, t.revocationDate == nil {
                return true
            }
        }
        return false
    }
}
