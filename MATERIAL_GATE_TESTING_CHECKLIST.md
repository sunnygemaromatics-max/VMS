# Material Gate Testing Checklist

1. Open `/material-pass` and confirm Overview, Gate Entries, Drivers, Vehicles, and Reports tabs load.
2. Create a receipt entry with branch, vehicle, driver, material, and three photos.
3. Verify duplicate active entry prevention by trying to create a second open entry for the same vehicle.
4. Create a dispatch entry and confirm the dispatch workflow shows `PENDING`, `SECURITY_VERIFIED`, `LOADED`, and `GATE_OUT`.
5. Use `Auto-fill from master` after entering vehicle number or driver mobile and confirm existing master data fills into the form.
6. Mark a vehicle or driver as `BLACKLISTED` in the master and confirm entry creation requires manual override.
7. Set expired insurance, PUC, fitness, or license dates and confirm override enforcement.
8. Try final `GATE_OUT` without an after-photo and confirm validation blocks it.
9. Select an existing entry, update remarks, and confirm the record refreshes with timeline events.
10. Print a gate pass and confirm QR, driver, vehicle, material, and signature areas are visible.
11. Run report filters for vehicle, driver, supplier, customer, material, transporter, location, status, and entry type.
12. Export the current report as CSV, Excel, and PDF and confirm the filtered rows match the screen.
13. Run `node seed_material_gate.js` in an environment with database access to add a demo receipt row if needed.
