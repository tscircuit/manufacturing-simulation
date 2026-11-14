# Bare unit: packaging and shipping to Amazon FBA

The bare unit is the motor controller without a motor. Each bag holds:

- the RP2040 controller board;
- one 4 mm backface spacer;
- four long M3 screws, in their own small pouch so they can't scratch the board;
- the motor-to-board cable.

QC keeps one test motor. Every board is set down beside it, plugged in with the test motor's cable, DATA and PWR, and spun before it's bagged. Boards are never screwed onto the test motor. There's no assembly bench on this line.

This is a research summary from public sources as of November 2026, not legal advice. Amazon's Seller Central help pages need a login, and Amazon's product pages returned errors when I tried to read them. The Amazon rules below come from sellers' and prep vendors' summaries of them, and the bag listings from Amazon search results. Check each against Seller Central (Help → "Packaging and prep requirements", "Poly bagging", "Shipping and routing requirements") and the listings themselves before ordering.

## What goes in the bag, and how big it needs to be

| Part | Size | Notes |
| --- | --- | --- |
| Controller board | 42.3 × 43.6 mm, 6.4 mm high | 1.6 mm board plus the 4.8 mm side-entry JST, whose mouth sticks out 1.25 mm |
| Backface spacer | 42 × 42 × 4 mm | 1 mm base plus 3 mm sleeves. It goes under the board, protecting the flat back. |
| 4 long M3 screws | M3 × 16 mm with 5.5 mm heads, 4 side by side ≈ 22 × 19 × 3 mm | In a 2" × 3" pink anti-static zip pouch, folded in half to about 51 × 38 × 7 mm |
| Motor-to-board cable | 150 mm, 6-pin JST PH to PHR-4, coiled ≈ 46 × 46 × 5 mm | |

How it packs:

- **One stack** (board, spacer, cable and pouch on top of each other) is 51 × 46 mm and 20 mm thick. It doesn't fit an 80 mm bag, and it presses the screws onto the board's components.
- **Two piles side by side** (the board on its spacer, 10.4 mm; the cable with the folded pouch on top, about 12 mm) are 51 × 91 mm and 12 mm thick at most. A flat zip bag needs about the contents' size plus their thickness, plus room for the zip:
  - **Width:** 51 + 12 + 6 = **69 mm**.
  - **Length:** 91 + 6 + 15 (the zip) + 3 = **115 mm**.

### Does it fit the bag we ordered?

We ordered the [Ellbest 3.15" × 4.72" (80 × 120 mm) resealable ESD shielding bags, 200 per pack](https://www.amazon.com/dp/B07QFZBT9Z). Translucent grey metallized PET, zip near the top.

- **Parts: yes, snugly.** About 11 mm to spare across and about 5 mm along. Keep the two piles side by side (board at the bottom, cable and pouch above). Stacked, it won't close.
- **The original 2" × 4" tscircuit label: only just.** Between the bottom seal (about 3 mm) and the zip (about 15 mm from the top) there is about 102 mm of flat front, and the label is 101.6 mm. It covers the whole front, and once the bag is filled its bottom edge sits on the curve of the bag and may lift or crease. Put it on squarely, just under the zip, and press the bottom edge down after filling.
- I couldn't open the Amazon listing to confirm the exact zip position and seal widths, so pack one unit and check before printing a full sheet run.

## Bags to buy on Amazon

| Use | Pick | Why | Alternatives |
| --- | --- | --- | --- |
| **Outer bag (ordered)** | [Ellbest 3.15" × 4.72" ESD shielding zip bags, 200 pack (B07QFZBT9Z)](https://www.amazon.com/dp/B07QFZBT9Z) | Already ordered. Metallized, see-through enough to show the parts, recloses, and the 80 mm opening needs no suffocation warning. | |
| **Screw pouch** | [APQ Supply 2" × 3" pink anti-static 4 mil reclosable bags](https://www.amazon.com/clp/B07S5GNRHL) | Static-dissipative pink film, so it won't charge up against the board inside the outer bag. 4 mil resists screw threads. Folded in half it is 51 × 38 mm, which fits beside the board. | [Poly Bag Guy 2" × 3" 2 mil pink anti-static, 1000](https://www.amazon.com/Poly-Bag-Guy-PBGPBAS700-Anti-Static/dp/B07CLLQ1BS) (thinner, cheaper); [HRX Plastics 2.5" × 3" pink anti-static, 100](https://www.amazon.com/clp/B07CYLX7YW) |

I didn't find a 2" × 2" pink anti-static bag on Amazon, which is why the pouch is 2" × 3" folded in half. Confirm thickness, count and price on each listing before ordering.

## The bag and its labels

| Requirement | What applies | What we do |
| --- | --- | --- |
| **Bag type** | The board is static-sensitive. Metallized static-shielding bags block outside fields; pink anti-static bags only stop charge building up. | Ellbest 80 × 120 mm metallized shielding zip bag, with a yellow ESD caution sticker on the back. |
| **Thickness** | Amazon's minimum for poly bags is 1.5 mil. | The listing doesn't give one. Metallized shielding film is normally about 3 mil; check a bag with calipers. The pouch is 4 mil. |
| **Suffocation warning** | Needed when the bag's opening is 5" or more. It must be printed or labelled, prominent and legible, at 10 pt or larger for bags whose length plus width is under 29". Amazon's example: "Warning: To avoid danger of suffocation, keep this bag away from babies and children. Do not use this bag in cribs, beds, carriages, or playpens. This bag is not a toy." Several US states have their own rules for bags big enough to go over a child's head. | The 80 mm (3.15") outer and 2" pouch openings are well under 5", so no warning is required. |
| **Barcode** | Each unit needs exactly one scannable barcode, the FNSKU, on the outside, flat and unwrinkled. Amazon's FNSKU labels are 1" × 2" up to 2" × 3". | 1" × 2-5/8" FNSKU label (Avery 5160-size, 30 per sheet, printed from Seller Central) on the back. It fits the 80 mm width with about 7 mm each side, above the caution sticker. |
| **Product label** | Not an Amazon requirement. It must not carry a second scannable barcode. | The original tscircuit 2" × 4" label from [tscircuit/product-packaging](https://github.com/tscircuit/product-packaging/tree/main/products/nema17), unchanged, on the same AveneMark sheets the kit uses. No extra text. |
| **Closure** | The bag must be sealed so parts can't fall out. | Zip the pouch, then zip the outer bag. Add an impulse heat seal if tamper evidence becomes a problem. |

Amazon ended its own US prep and labelling services for shipments created from January 1, 2026, so all of this must be done before the box leaves the lab.

## Shipping to Amazon

| Requirement | Amazon rule | Our carton |
| --- | --- | --- |
| **Size** | No side over 25". | 10 × 8 × 6 in inside. |
| **Weight** | 50 lb standard. Over 50 lb needs "Team Lift" labels on the top and sides. | A bagged unit is about 23 g: board 8, spacer 2.6, screws 4.4, cable 5, bags 3.5. 30 of them plus the carton ≈ 2 lb. |
| **Packing** | Bags shouldn't move, and loose fill such as packing peanuts or shredded paper isn't allowed. | 30 bags standing on edge, 3 along by 10 across. Fill the gap at the side with a sheet of kraft paper. |
| **Box ID label** | Every carton gets its own FBA box ID label from the shipment in Seller Central. Never reuse one. Put it on a flat side, not across a seam, and don't cover it with the carrier label. | 4" × 6" label on a long side, applied before sealing. |
| **Box contents** | Enter the SKU and quantity for each box in Seller Central. Wrong contents can bring fees or blocked shipments. | One SKU, 30 units per box. |
| **Old markings** | Remove or cover any old labels or barcodes on a reused box. | New cartons only. |

## Manufacturing steps for the bare unit

1. **Spacers (P2S and H2S).** Print the 4 mm backface spacers and refill the bagging bench's basket from the tub.
2. **QC bench (where the assembly bench used to be; one test motor).** All 30 boards arrive in a black ESD tray with an amber rim. For each board:
   1. Set it on the ESD mat right beside the test motor. Don't screw it on.
   2. Plug in the test motor's cable (J1), the laptop USB-C (DATA) and the charging station (PWR).
   3. Spin the motor and watch current and stall on the laptop.
   4. Unplug everything and put the board in the passed tray (green rim).

   Test one at a time (green circle) or all 30, and carry the passed tray to bagging (amber circle) whenever you like.
3. **Labels.** The Epson prints the original 2" × 4" tscircuit labels on AveneMark sheets, the same as the kit line. FNSKU sheets come from Seller Central.
4. **Bagging bench (where QC used to be).** For each unit:
   1. Take a 2" × 3" pink pouch from its box, drop in the 4 long M3 screws side by side, zip it, and fold it in half over the screws.
   2. Take an 80 × 120 mm Ellbest shielding bag (caution sticker on the back) and hold it open by hand, its bottom resting on the bench. No bag holder.
   3. Put in a spacer, the tested board on top of it, a coiled cable beside them, and the folded screw pouch on the cable.
   4. Zip the bag and lay it flat, front up.
   5. Put the original tscircuit 2" × 4" label on the front, just under the zip. Turn the bag over and put the FNSKU label on the back, above the caution sticker. Labels go on flat, which is easier by hand.
   6. Lay the bag in the tote.
5. **Ship-ready bench.** Stand the 30 bags in the 10 × 8 × 6 carton, put the FBA box ID label on the side, fold the flaps, tape the seam, and set the carton by the door.

## Sources

- [Ellbest 3.15" × 4.72" antistatic shielding bags, 200 (Amazon)](https://www.amazon.com/dp/B07QFZBT9Z)
- [Poly Bag Guy 2" × 3" pink anti-static bags (Amazon)](https://www.amazon.com/Poly-Bag-Guy-PBGPBAS700-Anti-Static/dp/B07CLLQ1BS)
- [HRX Plastics 2.5" × 3" pink anti-static bags (Amazon)](https://www.amazon.com/clp/B07CYLX7YW)
- [tscircuit/product-packaging: NEMA17 label](https://github.com/tscircuit/product-packaging/tree/main/products/nema17)
- [APQ Supply 2" × 3" pink anti-static reclosable bags (Amazon)](https://www.amazon.com/clp/B07S5GNRHL)
- [Partners Brand PPBAS2105 2½" × 3" pink anti-static 4 mil bags (Amazon)](https://www.amazon.com/Select-Size-Partners-Brand-Anti-Static/dp/B01MTFPNEC)

- [ComplianceGate: bag suffocation warnings, Amazon and US states](https://www.compliancegate.com/bag-suffocation-warning/)
- [EcoEnclose: poly bag suffocation requirements](https://help.ecoenclose.com/en-US/what-are-poly-bag-suffocation-requirements-185611)
- [Amazon seller forum: poly bag warning and transparency](https://sellercentral.amazon.com/seller-forums/discussions/t/7a5dad5f-891d-4958-b860-c1175483395c)
- [SNS Prep Center: FBA prep for electronics (anti-static vs shielding bags)](https://snsprepcenter.com/blog/amazon-fba-prep-electronics-tech-products-guide)
- [Pattern: Amazon is ending FBA prep services in 2026](https://www.pattern.com/blog/amazon-is-ending-fba-prep-services-in-2026)
- [Jungle Scout: Amazon FBA packaging requirements](https://www.junglescout.com/blog/amazon-packaging-requirements/)
- [Amazon Seller Central: shipping and routing requirements](https://sellercentral.amazon.com/gp/help/external/G200141510) (login required)
