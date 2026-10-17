import { useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CloseIcon from "@mui/icons-material/Close";
import FacebookIcon from "@mui/icons-material/Facebook";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import LiveTvOutlinedIcon from "@mui/icons-material/LiveTvOutlined";
import PictureAsPdfOutlinedIcon from "@mui/icons-material/PictureAsPdfOutlined";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import type { ReactNode } from "react";
import type { Match } from "../../api/matchApi";
import type { MatchResult } from "../../api/matchResultApi";
import type { Team } from "../../api/teamApi";
import { useShareChoices } from "../../hooks/useShareChoices";
import { useShareResultData } from "../../hooks/useShareResultData";
import { useShareSettings } from "../../hooks/useShareSettings";
import { MAX_SHARE_SPONSORS } from "../../utils/share/logoLayout";
import type { ShareFormat } from "../../utils/share/shareChoices";
import { buildShareResultModel } from "../../utils/share/shareResultData";
import { Button } from "../Button";
import { ShareFooterContext } from "../ShareFormatScreen";
import { TileChoiceGroup } from "../TileChoiceGroup";
import { FacebookShareScreen } from "./FacebookShareScreen";
import { ImageShareScreen } from "./ImageShareScreen";
import { PdfShareScreen } from "./PdfShareScreen";
import { TvShareScreen } from "./TvShareScreen";
import { WhatsAppShareScreen } from "./WhatsAppShareScreen";
import { resolveShareInitials } from "./useShareInitials";

export interface ShareResultDialogProps {
  open: boolean;
  onClose: () => void;
  clubId: string;
  match: Match;
  result: MatchResult;
  teamsById: Map<string, Team>;
}

interface FormatTile {
  value: ShareFormat;
  title: string;
  subtitle: string;
  icon: ReactNode;
}

const TILES: FormatTile[] = [
  {
    value: "PDF",
    title: "PDF scorecard",
    subtitle: "Full scorecard, A4, to print or send",
    icon: <PictureAsPdfOutlinedIcon />,
  },
  {
    value: "IMAGE",
    title: "Image",
    subtitle: "Result card for feeds and chats",
    icon: <ImageOutlinedIcon />,
  },
  {
    value: "TV",
    title: "TV summary",
    subtitle: "Widescreen match summary",
    icon: <LiveTvOutlinedIcon />,
  },
  {
    value: "WHATSAPP",
    title: "WhatsApp",
    subtitle: "Message text plus image",
    icon: <WhatsAppIcon />,
  },
  {
    value: "FACEBOOK",
    title: "Facebook",
    subtitle: "Post text plus image",
    icon: <FacebookIcon />,
  },
];

const ARROW_KEYS = [
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Home",
  "End",
];

// docs/specs/114-share-result.md (ShareResultDialog): one dialog, five formats. Step 1 is the tiles, step 2 the chosen
// format's screen with a Back button. Full screen on a phone. Everything it reads is fetched only while it is open.
export function ShareResultDialog({
  open,
  onClose,
  clubId,
  match,
  result,
  teamsById,
}: ShareResultDialogProps) {
  const theme = useTheme();
  const phone = useMediaQuery(theme.breakpoints.down("sm"));
  const [screen, setScreen] = useState<ShareFormat | null>(null);
  const [footer, setFooter] = useState<HTMLElement | null>(null);
  const [picked, setPicked] = useState<ShareFormat | null>(null);
  const [choices, updateChoices] = useShareChoices(clubId);
  const settings = useShareSettings(clubId, open);
  const data = useShareResultData(clubId, match, result, teamsById, open);

  useEffect(() => {
    if (!open) {
      setScreen(null);
      setPicked(null);
    }
  }, [open]);

  const initials = resolveShareInitials({
    choices,
    updateChoices,
    junior: data.junior,
    settings: settings.settings,
    setClubDefault: settings.setInitialsOnlyDefault,
    clubDefaultSaving: settings.isSaving,
    clubDefaultFailed: settings.saveFailed,
  });

  const candidateIds = useMemo(
    () => new Set(data.sponsors.map((sponsor) => sponsor.id)),
    [data.sponsors],
  );
  const remembered = choices.sponsorIds
    .filter((id) => candidateIds.has(id))
    .slice(0, MAX_SHARE_SPONSORS);
  const selectedSponsorIds =
    remembered.length > 0
      ? remembered
      : data.defaultSponsorId
        ? [data.defaultSponsorId]
        : [];

  const teams = useMemo(() => Array.from(teamsById.values()), [teamsById]);
  const model = useMemo(
    () =>
      buildShareResultModel({
        match,
        result,
        scorecard: data.scorecard,
        teams,
        clubName: data.clubProfile?.name ?? null,
        leagueName: data.league?.name ?? null,
        teamsChoice: choices.teams,
        initialsOnly: initials.value,
      }),
    [
      match,
      result,
      data.scorecard,
      teams,
      data.clubProfile,
      data.league,
      choices.teams,
      initials.value,
    ],
  );
  // The Image and TV cards and the attached image always show both teams (they never offer Our team only).
  const cardModel = useMemo(
    () =>
      buildShareResultModel({
        match,
        result,
        scorecard: data.scorecard,
        teams,
        clubName: data.clubProfile?.name ?? null,
        leagueName: data.league?.name ?? null,
        teamsChoice: "both",
        initialsOnly: initials.value,
      }),
    [
      match,
      result,
      data.scorecard,
      teams,
      data.clubProfile,
      data.league,
      initials.value,
    ],
  );
  // Team names only: with First names as initials on, no title or file name ever carries a player's name.
  const shareTitle = `${model.home.name} v ${model.away.name}`;

  // Arrow keys only move the highlight between tiles; a click, Enter or Space opens the format.
  const arrowing = useRef(false);
  const choose = (format: ShareFormat) => {
    setPicked(format);
    if (arrowing.current) {
      arrowing.current = false;
      return;
    }
    updateChoices({ format });
    setScreen(format);
  };

  // The last format used is highlighted on opening.
  const highlighted =
    picked ??
    TILES.find((tile) => tile.value === choices.format)?.value ??
    null;

  const screenProps = {
    model,
    cardModel,
    clubLogoUrl: data.clubProfile?.logoUrl ?? null,
    leagueLogoUrl: data.league?.logoUrl ?? null,
    clubWebsite: data.clubProfile?.website ?? null,
    choices,
    updateChoices,
    initials,
    sponsors: data.sponsors,
    selectedSponsorIds,
    shareTitle,
  };
  const tile = TILES.find((item) => item.value === screen);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={phone}
      fullWidth
      maxWidth="lg"
      aria-labelledby="share-result-title"
    >
      <DialogTitle
        id="share-result-title"
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
          pr: 1,
        }}
      >
        <Box component="span">Share result</Box>
        <IconButton
          aria-label="Close"
          onClick={onClose}
          sx={{ width: 44, height: 44 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ px: { xs: 2, sm: 3 }, pb: 2 }}>
        {screen === null || !tile ? (
          <Box
            onKeyDownCapture={(event) => {
              arrowing.current = ARROW_KEYS.includes(event.key);
            }}
            onKeyUpCapture={() => {
              arrowing.current = false;
            }}
          >
            <TileChoiceGroup<ShareFormat>
              label="Share format"
              value={highlighted}
              onChange={choose}
              columns={{
                xs: "minmax(0, 1fr)",
                sm: "repeat(2, minmax(0, 1fr))",
                md: "repeat(3, minmax(0, 1fr))",
              }}
              tileSx={{
                minHeight: 88,
                py: 1.5,
                textAlign: "left",
                justifyContent: "flex-start",
                alignItems: "center",
              }}
              options={TILES.map((item) => ({
                value: item.value,
                content: (
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1.5,
                      width: "100%",
                    }}
                  >
                    <Box
                      sx={{
                        color: "primary.main",
                        display: "flex",
                        "& svg": { fontSize: 32 },
                      }}
                    >
                      {item.icon}
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 700 }}>
                        {item.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {item.subtitle}
                      </Typography>
                    </Box>
                  </Box>
                ),
              }))}
            />
          </Box>
        ) : (
          <ShareFooterContext.Provider value={footer}>
            <Box>
              <Button
                variant="ghost"
                size="sm"
                startIcon={<ArrowBackIcon fontSize="small" />}
                onClick={() => setScreen(null)}
                sx={{ ml: -1, mb: 1, color: "text.secondary" }}
              >
                Back
              </Button>
              {data.isLoading ? (
                <Box
                  role="status"
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1.5,
                    py: 3,
                  }}
                >
                  <CircularProgress size={20} />
                  <Typography color="text.secondary">
                    Loading the result details…
                  </Typography>
                </Box>
              ) : screen === "PDF" ? (
                <PdfShareScreen {...screenProps} />
              ) : screen === "WHATSAPP" ? (
                <WhatsAppShareScreen {...screenProps} />
              ) : screen === "FACEBOOK" ? (
                <FacebookShareScreen {...screenProps} />
              ) : screen === "IMAGE" ? (
                <ImageShareScreen {...screenProps} />
              ) : screen === "TV" ? (
                <TvShareScreen {...screenProps} />
              ) : null}
            </Box>
          </ShareFooterContext.Provider>
        )}
      </DialogContent>
      {screen !== null && tile && !data.isLoading && (
        <DialogActions
          sx={{
            display: "block",
            px: { xs: 2, sm: 3 },
            pt: 1.5,
            pb: "max(12px, env(safe-area-inset-bottom))",
            borderTop: 1,
            borderColor: "divider",
            bgcolor: "background.paper",
          }}
        >
          <Box
            ref={setFooter}
            data-testid="share-footer"
            sx={{ minWidth: 0 }}
          />
        </DialogActions>
      )}
    </Dialog>
  );
}
