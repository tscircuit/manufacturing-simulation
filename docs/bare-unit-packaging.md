# Bare unit: packaging and shipping to Amazon FBA

The bare unit is the motor controller without a motor. Each bag holds:

- the RP2040 controller board;
- one 4 mm backface spacer;
- four long M3 screws, in their own small pouch so they can't scratch the board;
- the motor-to-board cable.

QC keeps one test motor and spins every board on it before it's bagged.

This is a research summary from public sources as of November 2026, not legal advice. Amazon's Seller Central help pages need a login, and Amazon's product pages returned errors when I tried to read them. The Amazon rules below come from sellers' and prep vendors' summaries of them, and the bag listings from Amazon search results. Check each against Seller Central (Help → "Packaging and prep requirements", "Poly bagging", "Shipping and routing requirements") and the listings themselves before ordering.

## What goes in the bag, and how big it needs to be

| Part | Size | Notes |
| --- | --- | --- |
| Controller board | 42.3 × 43.6 mm, 6.4 mm high | 1.6 mm board plus the 4.8 mm side-entry JST, whose mouth sticks out 1.25 mm |
| Backface spacer | 42 × 42 × 4 mm | 1 mm base plus 3 mm sleeves. It goes under the board, protecting the flat back. |
| 4 long M3 screws | M3 × 16 mm with 5.5 mm heads, 4 side by side ≈ 22 × 19 × 3 mm | In a 2" × 3" pink anti-static zip pouch, folded in half to about 51 × 38 × 5 mm |
| Motor-to-board cable | 150 mm, 6-pin JST PH to PHR-4, coiled ≈ 46 × 46 × 5 mm | |

How it packs:

- **One stack** (board, spacer, cable and pouch on top of each other) is 51 × 46 mm and 20 mm thick. A flat bag needs about the contents' width plus their thickness plus a little more, which is about 77 mm, so it doesn't fit a 3" bag. It also presses the screws onto the board's components.
- **Two piles side by side** (the board on its spacer; the cable with the screw pouch on top) are 51 × 91 mm and 10.4 mm thick. That needs about **67 mm wide** (51 + 10.4 + 6) by **113 mm long** (91 + 5 for thickness + 13 for the zip + 3) inside a flat zip bag.
- **A 3" × 5" bag (76 × 127 mm) fits with about 9 mm and 14 mm to spare.** That's snug but not tight. A 3" × 4" bag is too short, and 4" × 6" is more than twice the area needed.

## Bags to buy on Amazon

| Use | Pick | Why | Alternatives |
| --- | --- | --- | --- |
| **Outer bag** | [SCS 30035 transparent metal-in static shielding bag, ZipTop, 3" × 5", 100 per container](https://www.amazon.com/SCS-Transparent-Metal-Static-Shielding/dp/B01N4NNQVN) | SCS (Desco) is an ESD-standards brand. The metal-in film shields the board and is see-through, and the zip top recloses. | [Laddawn 4150 3" × 5" 3 mil reclosable static shielding bags (100)](https://www.amazon.com/Mil-Reclosable-Static-Shielding-Bags/dp/B01B1ZO2CY) |
| **Screw pouch** | [APQ Supply 2" × 3" pink anti-static 4 mil reclosable bags](https://www.amazon.com/clp/B07S5GNRHL) | Static-dissipative pink film, so it won't charge up against the board inside the outer bag. 4 mil resists screw threads. | [Partners Brand 2½" × 3" pink anti-static 4 mil (PPBAS2105)](https://www.amazon.com/Select-Size-Partners-Brand-Anti-Static/dp/B01MTFPNEC) |

I didn't find a 2" × 2" pink anti-static bag on Amazon, which is why the pouch is 2" × 3" folded in half. Confirm thickness, count and price on each listing before ordering. Then pack one unit and measure it.

## The bag and its labels

| Requirement | What applies | What we do |
| --- | --- | --- |
| **Bag type** | The board is static-sensitive. Metallized static-shielding bags block outside fields; pink anti-static bags only stop charge building up. Amazon wants poly bags clear except where it allows otherwise, with the barcode outside on an opaque bag. | 3" × 5" metal-in static-shielding zip bag, about 3 mil. It's see-through enough to show the parts. |
| **Thickness** | Amazon's minimum for poly bags is 1.5 mil. | About 3 mil outer and 4 mil pouch. |
| **Suffocation warning** | Needed when the bag's opening is 5" or more. It must be printed or labelled, prominent and legible, at 10 pt or larger for bags whose length plus width is under 29". Amazon's example: "Warning: To avoid danger of suffocation, keep this bag away from babies and children. Do not use this bag in cribs, beds, carriages, or playpens. This bag is not a toy." Several US states have their own rules for bags big enough to go over a child's head. | The 3" outer and 2" pouch openings are well under 5", so no warning is required. A 3" × 5" bag can't go over a child's head either. |
| **Barcode** | Each unit needs exactly one scannable barcode, the FNSKU, on the outside, flat and unwrinkled. Amazon's FNSKU labels are 1" × 2" up to 2" × 3". | 1" × 2-5/8" FNSKU label (Avery 5160-size, 30 per sheet, printed from Seller Central) on the back. It fits the 3" width with about 3/16" each side. |
| **Product sticker** | Not an Amazon requirement. It must not carry a second scannable barcode. | 2" × 3" tscircuit sticker on the front: product name, what's inside, "Motor not included", the ESD note, "not a toy", and tscircuit.com. No barcode. |
| **Closure** | The bag must be sealed so parts can't fall out. | Zip the pouch, then zip the outer bag. Add an impulse heat seal if tamper evidence becomes a problem. |

Amazon ended its own US prep and labelling services for shipments created from January 1, 2026, so all of this must be done before the box leaves the lab.

## The product and its listing

- **FCC.** The board has a 12 MHz RP2040 and a stepper driver, so it's a digital device (an unintentional radiator) under FCC Part 15 Subpart B. Two routes:
  - **Sell to the public (recommended):** test the board to Part 15B Class B emissions and issue a Supplier's Declaration of Conformity (SDoC), with a US responsible party. Amazon's FCC Radio Frequency Emission Compliance listing attribute needs it, and Amazon removes RF-device listings without valid compliance information.
  - **Evaluation kit (47 CFR 2.803):** only allowed when sales are restricted to product developers, software developers and system integrators, which an open listing doesn't do. It also needs the FCC notice and the legend "For evaluation only; not FCC approved for resale".
- **Choking hazard.** The CPSC small-parts warnings (16 CFR 1500.19) apply to toys and games for young children. A motor-controller kit for makers and engineers isn't a children's product, so no choking-hazard warning is required. The screws are small parts, though, so don't list it in Toys, say "not a toy" on the sticker, and consider "Not for children under 14" in the listing.
- **Batteries and hazmat.** There are none, so no dangerous-goods review.
- **Origin claims.** Only print "Made in USA" or "Assembled in USA" if it meets the FTC's rules. The parts are imported, so leave it off unless you've checked.
- **Listing title.** Make it clear the motor isn't included, for example "NEMA 17 stepper motor controller board kit (RP2040, USB-C PD) – motor not included", to avoid "not as described" returns.

## Shipping to Amazon

| Requirement | Amazon rule | Our carton |
| --- | --- | --- |
| **Size** | No side over 25". | 10 × 8 × 6 in inside. |
| **Weight** | 50 lb standard. Over 50 lb needs "Team Lift" labels on the top and sides. | A bagged kit is about 23 g: board 8, spacer 2.6, screws 4.4, cable 5, bags 3.5. 30 of them plus the carton ≈ 2 lb. |
| **Packing** | Bags shouldn't move, and loose fill such as packing peanuts or shredded paper isn't allowed. | 30 bags standing on edge, 3 along by 10 across. Fill the gap at the side with a sheet of kraft paper. |
| **Box ID label** | Every carton gets its own FBA box ID label from the shipment in Seller Central. Never reuse one. Put it on a flat side, not across a seam, and don't cover it with the carrier label. | 4" × 6" label on a long side, applied before sealing. |
| **Box contents** | Enter the SKU and quantity for each box in Seller Central. Wrong contents can bring fees or blocked shipments. | One SKU, 30 units per box. |
| **Old markings** | Remove or cover any old labels or barcodes on a reused box. | New cartons only. |

## Manufacturing steps for the bare unit

1. **Spacers (P2S and H2S).** Print the 4 mm backface spacers and refill the kitting bench's basket from the tub.
2. **Kitting bench (the old assembly bench, no motors).** For each unit:
   1. Lay a spacer on the jig.
   2. Put a controller board on it.
   3. Put 4 long M3 screws in a 2" × 3" pink pouch and zip it.
   4. Add a coiled motor-to-board cable.
   5. Put the kit in the rack.

   Kit one at a time (green circle) or all 30, and take the rack (amber circle) whenever you like.
3. **QC bench (one test motor).** Put the board on the test motor's back face, plug the test motor's cable into J1, then the laptop USB-C into DATA and the charging station into PWR. Spin the motor. Unplug everything, put the board back in its kit, and move the kit to the ready rack.
4. **Labels.** The Epson prints 2" × 3" tscircuit stickers. FNSKU sheets come from Seller Central.
5. **Bagging bench (the old pack-out bench).**
   1. Stand a 3" × 5" static-shielding bag open on the wire stand.
   2. Slide the kit in: board on its spacer at the bottom, the cable and screw pouch above it.
   3. Zip the bag.
   4. Put the tscircuit sticker on the front and the FNSKU label on the back.
   5. Lay the bag in the tote.
6. **Ship-ready bench.** Stand the 30 bags in the 10 × 8 × 6 carton, put the FBA box ID label on the side, fold the flaps, tape the seam, and set the carton by the door.

## Sources

- [SCS 30035 3" × 5" transparent metal-in static shielding ZipTop bags (Amazon)](https://www.amazon.com/SCS-Transparent-Metal-Static-Shielding/dp/B01N4NNQVN)
- [Laddawn 4150 3" × 5" 3 mil reclosable static shielding bags (Amazon)](https://www.amazon.com/Mil-Reclosable-Static-Shielding-Bags/dp/B01B1ZO2CY)
- [APQ Supply 2" × 3" pink anti-static reclosable bags (Amazon)](https://www.amazon.com/clp/B07S5GNRHL)
- [Partners Brand PPBAS2105 2½" × 3" pink anti-static 4 mil bags (Amazon)](https://www.amazon.com/Select-Size-Partners-Brand-Anti-Static/dp/B01MTFPNEC)

- [ComplianceGate: bag suffocation warnings, Amazon and US states](https://www.compliancegate.com/bag-suffocation-warning/)
- [EcoEnclose: poly bag suffocation requirements](https://help.ecoenclose.com/en-US/what-are-poly-bag-suffocation-requirements-185611)
- [Amazon seller forum: poly bag warning and transparency](https://sellercentral.amazon.com/seller-forums/discussions/t/7a5dad5f-891d-4958-b860-c1175483395c)
- [SNS Prep Center: FBA prep for electronics (anti-static vs shielding bags)](https://snsprepcenter.com/blog/amazon-fba-prep-electronics-tech-products-guide)
- [Pattern: Amazon is ending FBA prep services in 2026](https://www.pattern.com/blog/amazon-is-ending-fba-prep-services-in-2026)
- [Jungle Scout: Amazon FBA packaging requirements](https://www.junglescout.com/blog/amazon-packaging-requirements/)
- [Amazon Seller Central: shipping and routing requirements](https://sellercentral.amazon.com/gp/help/external/G200141510) (login required)
- [eCFR 47 CFR 2.803: marketing of RF devices before authorization (evaluation kits)](https://www.ecfr.gov/current/title-47/chapter-I/subchapter-A/part-2/subpart-I/section-2.803)
- [eCFR 47 CFR Part 15 Subpart B: unintentional radiators](https://www.ecfr.gov/current/title-47/chapter-I/subchapter-A/part-15/subpart-B)
- [TÜV SÜD: Amazon's FCC RF emission compliance listing policy](https://www.tuvsud.com/en-us/services/product-certification/fcc-tcb/amazon-radio-frequency-emission-policy)
- [ComplianceGate: Amazon electronics requirements](https://www.compliancegate.com/amazon-electronics-requirements/)
- [CPSC: small parts and choking hazard labelling FAQs](https://cpsc.gov/FAQ/Small-Parts-and-Choking-Hazard-Labeling-FAQs)
