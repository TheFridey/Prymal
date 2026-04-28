/**
 * Brands removed from upstream `simple-icons` (license) or clearer via Tabler/FA.
 * Icons come from react-icons (not Prymal-authored SVG paths).
 */
import { FaMicrosoft } from 'react-icons/fa';
import { SiSlack } from 'react-icons/si';
import {
  TbBrandLinkedinFilled,
  TbBrandOffice,
  TbBrandOnedrive,
  TbBrandTeams,
  TbWebhook,
} from 'react-icons/tb';

export const REACT_MARKS = {
  slack: { Icon: SiSlack, hex: '4A154B' },
  slack_incoming_webhook: { Icon: SiSlack, hex: '4A154B' },
  linkedin: { Icon: TbBrandLinkedinFilled, hex: '0A66C2' },
  outlook: { Icon: TbBrandOffice, hex: 'D83B01' },
  onedrive: { Icon: TbBrandOnedrive, hex: '0078D4' },
  teams_incoming: { Icon: TbBrandTeams, hex: '6264A7' },
  /** SharePoint has no SI slug; FA Microsoft logo + SharePoint-aligned hex. */
  sharepoint: { Icon: FaMicrosoft, hex: '038387' },
  /** Vendor Tabler webhook (generic endpoint icon). */
  custom_webhook: { Icon: TbWebhook, hex: 'F97316' },
};
