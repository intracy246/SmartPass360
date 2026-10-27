# SmartPass360 Reception Printer Setup

## Visitor workflow

1. Connect a supported printer to the Reception/Security computer using USB, the network, or Bluetooth.
2. Install the manufacturer's driver and print an operating-system test page.
3. Set the intended printer as the computer's default printer. For thermal printers, select the 80 mm paper/roll size in printer preferences.
4. Open the SmartPass360 dashboard on that same computer and allow pop-ups for the dashboard site.
5. In Visitor Queue, select **Approve & print pass**. SmartPass360 approves the pending visit, opens the pass in a reserved print window, and invokes the browser print operation automatically.
6. Confirm the print dialog uses the intended printer and correct paper size. The printed pass contains English and Kiswahili instructions to return the pass to Security when the visitor exits.

## Silent printing on a dedicated reception computer

A normal browser is not permitted to silently send a website's print job directly to a physical printer. It will open the system/browser print dialog. To print without a confirmation dialog, configure a dedicated, trusted Reception/Security computer with Chrome/Chromium kiosk printing and a tested default printer.

On a managed Windows workstation, create a dedicated browser shortcut with the appropriate installed Chrome path and the flags below:

```text
--kiosk-printing --kiosk https://smartpass.smartcycle360.com
```

If Chrome is installed elsewhere, adjust the executable path. Sign in to SmartPass360 in that dedicated browser session, set the correct printer as the OS default, and test several sample passes before operational use. Keep the workstation physically controlled; do not enable silent printing on shared or personal devices.

Bluetooth and USB are transport options handled by the operating system/printer driver. SmartPass360 does not pair with a printer itself. The printer must be paired/connected, online, loaded with paper, and selected as default for kiosk printing to work reliably.

## Failure handling

- If pop-ups are blocked, SmartPass360 does not approve the visit; allow pop-ups and retry.
- If the pass is issued but printing fails, use the visible **Print ticket** recovery action and check the browser printer settings.
- Never treat a pass as physically printed until the printer has produced the ticket. Keep Security's access-control procedure in place if a printer or workstation is offline.
