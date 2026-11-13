# Bare unit: packaging and shipping to Amazon FBA

The bare unit is the tested NEMA17 motor with the RP2040 controller board (backface spacer, long M3 screws and the motor cable fitted), sold on its own in a bag: no mailer box, USB-C cables or charger.

This is a research summary from public sources as of November 2026, not legal advice. Amazon's Seller Central help pages need a login, so the Amazon figures below come from sellers' and prep vendors' summaries of them. Check each against Seller Central (Help → "Packaging and prep requirements", "Poly bagging", "Shipping and routing requirements") before ordering bags or labels.

## The bag

| Requirement | What applies | What we do |
| --- | --- | --- |
| **Bag type** | The board is static-sensitive. Metallized static-shielding bags block outside fields (a Faraday cage); pink anti-static bags only stop charge building up. Amazon wants poly bags clear except where it allows otherwise, and vendors say an opaque bag needs the barcode outside. | 4" × 6" reclosable metallized static-shielding bag, about 3 mil. It's see-through enough to show the unit. |
| **Thickness** | Amazon's minimum for poly bags is 1.5 mil. | Shielding bags are about 3 mil. |
| **Suffocation warning** | Needed when the bag's opening is 5" or more. It must be printed on the bag or labelled, prominent and legible, at 10 pt or larger for bags whose length plus width is under 29". Amazon's example text: "Warning: To avoid danger of suffocation, keep this bag away from babies and children. Do not use this bag in cribs, beds, carriages, or playpens. This bag is not a toy." California, New York, Massachusetts, Virginia and Rhode Island have their own rules for bags big enough to go over a child's head. | The 4" opening is under the 5" threshold, so no warning is required. It's cheap to have it printed anyway, which covers the state rules and any larger bag later. |
| **Barcode** | Each unit needs exactly one scannable barcode, the FNSKU, on the outside, flat and unwrinkled. Amazon's FNSKU labels are 1" × 2" up to 2" × 3". Any other barcode must be covered. | 1" × 2-5/8" FNSKU label (Avery 5160-size, 30 per sheet, printed from Seller Central) on the back of the bag, outside the film. |
| **Product sticker** | Not an Amazon requirement. It must not carry a second scannable barcode. | 2" × 3" tscircuit sticker on the front: product name, a short spec, the ESD handling note, "Development hardware, not a toy", and tscircuit.com. No barcode. |
| **Closure** | The bag must be sealed so the unit can't fall out. | Press the zip shut. An impulse heat seal across the top adds tamper evidence if returns become a problem. |

Amazon ended its own US prep and labelling services (poly bagging, FNSKU labels, suffocation labels) for shipments created from January 1, 2026, so all of this must be done before the box leaves the lab.

## The product and its listing

- **FCC.** The board has a 12 MHz RP2040 and a stepper driver, so it's a digital device (an unintentional radiator) under FCC Part 15 Subpart B. Two routes:
  - **Sell to the public (recommended):** test the board to Part 15B Class B emissions and issue a Supplier's Declaration of Conformity (SDoC), with a US responsible party. Amazon's FCC Radio Frequency Emission Compliance listing attribute needs it, and Amazon removes RF-device listings without valid compliance information.
  - **Evaluation kit (47 CFR 2.803):** only allowed when sales are restricted to product developers, software developers and system integrators, which an open Amazon listing doesn't do. It also needs the FCC notice and the legend "For evaluation only; not FCC approved for resale".
- **Choking hazard.** The CPSC small-parts warnings (16 CFR 1500.19) apply to toys and games for children, mainly ages 3 to 6. Children's products in general are those meant for ages 12 and under. A motor controller for makers and engineers isn't a children's product, so no choking-hazard warning is required. Don't list it in Toys, and say "not a toy" on the sticker and in the listing.
- **Batteries and hazmat.** There are none, so no dangerous-goods review.
- **Origin claims.** Only print "Made in USA" or "Assembled in USA" if it meets the FTC's rules. The board, motor and parts are imported, so leave it off unless you've checked.

## Shipping to Amazon

| Requirement | Amazon rule | Our carton |
| --- | --- | --- |
| **Size** | No side over 25". | 21 × 12 × 7 in inside, about 21.4 × 12.4 × 7.4 outside. |
| **Weight** | 50 lb standard. Over 50 lb needs "Team Lift" labels on the top and sides; sources disagree on the exact upper limit. | 30 × about 0.33 kg plus the carton ≈ 23 lb. Weigh a real packed unit to confirm. |
| **Packing** | Bags shouldn't move, and loose fill such as packing peanuts or shredded paper isn't allowed. | 30 bags standing on edge, 5 along by 6 across. Fill any gap with a sheet of bubble or kraft paper. |
| **Box ID label** | Every carton gets its own FBA box ID label from the shipment in Seller Central. Never reuse one. Put it on a flat side, not across a seam, and don't cover it with the carrier label. | 4" × 6" label on a long side, applied before sealing. |
| **Box contents** | Enter the SKU and quantity for each box in Seller Central. Wrong contents can bring fees or blocked shipments. | One SKU, 30 units per box. |
| **Old markings** | Remove or cover any old labels or barcodes on a reused box. | New cartons only. |

## Manufacturing steps for the bare unit

1. **Spacers (P2S and H2S).** Print the 4 mm backface spacers as now and refill the assembly basket from the tub.
2. **Assembly bench.** Same as the kit: load the motor in the jig, swap the 4 stock screws for long M3s through the spacer and the PCB, plug in the motor cable, rack it. Build one at a time (green circle) or the full 30, and take the rack (amber circle) whenever you like.
3. **QC bench.** Same as the kit: cradle, DATA and PWR USB-C, spin test, ready rack. Only units that pass go on.
4. **Labels.** The Epson prints 2" × 3" tscircuit stickers instead of the kit's 2" × 4" labels. FNSKU sheets come from Seller Central.
5. **Bagging bench (the old pack-out bench).**
   1. Take a flat 4×6 static-shielding bag from the tray, stand it in the wire stand and open it.
   2. Lower the tested unit in, shaft down, with the cable running across the bag.
   3. Press the zip shut.
   4. Put the tscircuit sticker on the front.
   5. Turn the bag round and put the FNSKU label on the back. That's the only barcode on the bag.
   6. Lay the bag in the tote.
6. **Ship-ready bench.** Stand the 30 bags in the 21 × 12 × 7 carton, put the FBA box ID label on the side, fold the flaps, tape the seam, and set the carton by the door.

## Sources

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
