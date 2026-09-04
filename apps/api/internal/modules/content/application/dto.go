package application

// InvitationContentDTO adalah representasi JSON dari invitation_content,
// dipakai baik oleh endpoint publik (PLAN.md §5.2) maupun admin (§5.1).
//
// weddingDateUnix: epoch DETIK (keputusan #16 PLAN.md) - dihitung sekali di
// Go dari kolom wedding_date (tz Asia/Jakarta, lihat internal/database).
// JANGAN mengembalikan wedding_date sebagai string mentah untuk dipakai
// countdown - frontend hanya boleh menampilkan weddingDateLabel dan
// menghitung dari weddingDateUnix.
type InvitationContentDTO struct {
	BrideName        string `json:"brideName"`
	BrideParentsText string `json:"brideParentsText"`
	BrideInstagram   string `json:"brideInstagram"`
	BridePhotoUrl    string `json:"bridePhotoUrl"`

	GroomName        string `json:"groomName"`
	GroomParentsText string `json:"groomParentsText"`
	GroomInstagram   string `json:"groomInstagram"`
	GroomPhotoUrl    string `json:"groomPhotoUrl"`

	WeddingDateUnix  int64  `json:"weddingDateUnix"`
	WeddingDateLabel string `json:"weddingDateLabel"`
	Hashtag          string `json:"hashtag"`

	CoverLogoUrl         string `json:"coverLogoUrl"`
	CoverImageDesktopUrl string `json:"coverImageDesktopUrl"`
	CoverImageMobileUrl  string `json:"coverImageMobileUrl"`

	QuoteText string `json:"quoteText"`

	ThanksTitle       string `json:"thanksTitle"`
	ThanksDescription string `json:"thanksDescription"`

	MusicUrl string `json:"musicUrl"`

	VideoGalleryTitle       string `json:"videoGalleryTitle"`
	VideoGalleryYoutubeUrl  string `json:"videoGalleryYoutubeUrl"`
	VideoGalleryCaption     string `json:"videoGalleryCaption"`
	LiveStreamingTitle      string `json:"liveStreamingTitle"`
	LiveStreamingYoutubeUrl string `json:"liveStreamingYoutubeUrl"`

	InstagramFilterTitle           string `json:"instagramFilterTitle"`
	InstagramFilterCaption         string `json:"instagramFilterCaption"`
	InstagramFilterPreviewPhotoUrl string `json:"instagramFilterPreviewPhotoUrl"`
	InstagramFilterLink            string `json:"instagramFilterLink"`

	WeddingGiftDescription string `json:"weddingGiftDescription"`

	DresscodeTitle       string `json:"dresscodeTitle"`
	DresscodeDescription string `json:"dresscodeDescription"`
	DresscodeNote        string `json:"dresscodeNote"`
	DresscodeImageUrl    string `json:"dresscodeImageUrl"`

	// ShareImageUrl: gambar khusus preview link WhatsApp/Facebook (og:image),
	// landscape ~1200x630. '' berarti belum diunggah - router jatuh ke
	// CoverImageDesktopUrl, lalu ke tag statis index.html (K4).
	ShareImageUrl string `json:"shareImageUrl"`

	// WeddingDateRaw dipakai HANYA untuk mengisi ulang form admin (input
	// datetime-local butuh nilai lokal, bukan epoch). Tidak dipakai countdown.
	WeddingDateRaw string `json:"weddingDateRaw"`
}

// UpdateInvitationContentInput adalah payload PATCH /api/v1/admin/content.
// Field sama seperti InvitationContentDTO, tapi wedding date diterima
// sebagai string "2006-01-02T15:04" (format input datetime-local HTML) yang
// lalu diparse ke waktu Asia/Jakarta oleh service - bukan epoch, supaya
// admin mengisi tanggal secara manusiawi.
type UpdateInvitationContentInput struct {
	BrideName        string `json:"brideName"`
	BrideParentsText string `json:"brideParentsText"`
	BrideInstagram   string `json:"brideInstagram"`
	BridePhotoUrl    string `json:"bridePhotoUrl"`

	GroomName        string `json:"groomName"`
	GroomParentsText string `json:"groomParentsText"`
	GroomInstagram   string `json:"groomInstagram"`
	GroomPhotoUrl    string `json:"groomPhotoUrl"`

	WeddingDate string `json:"weddingDate"`
	Hashtag     string `json:"hashtag"`

	CoverLogoUrl         string `json:"coverLogoUrl"`
	CoverImageDesktopUrl string `json:"coverImageDesktopUrl"`
	CoverImageMobileUrl  string `json:"coverImageMobileUrl"`

	QuoteText string `json:"quoteText"`

	ThanksTitle       string `json:"thanksTitle"`
	ThanksDescription string `json:"thanksDescription"`

	MusicUrl string `json:"musicUrl"`

	VideoGalleryTitle       string `json:"videoGalleryTitle"`
	VideoGalleryYoutubeUrl  string `json:"videoGalleryYoutubeUrl"`
	VideoGalleryCaption     string `json:"videoGalleryCaption"`
	LiveStreamingTitle      string `json:"liveStreamingTitle"`
	LiveStreamingYoutubeUrl string `json:"liveStreamingYoutubeUrl"`

	InstagramFilterTitle           string `json:"instagramFilterTitle"`
	InstagramFilterCaption         string `json:"instagramFilterCaption"`
	InstagramFilterPreviewPhotoUrl string `json:"instagramFilterPreviewPhotoUrl"`
	InstagramFilterLink            string `json:"instagramFilterLink"`

	WeddingGiftDescription string `json:"weddingGiftDescription"`

	DresscodeTitle       string `json:"dresscodeTitle"`
	DresscodeDescription string `json:"dresscodeDescription"`
	DresscodeNote        string `json:"dresscodeNote"`
	DresscodeImageUrl    string `json:"dresscodeImageUrl"`

	ShareImageUrl string `json:"shareImageUrl"`
}

type AgendaEventDTO struct {
	ID           uint64 `json:"id"`
	EventLabel   string `json:"eventLabel"`
	TimeLabel    string `json:"timeLabel"`
	VenueName    string `json:"venueName"`
	VenueAddress string `json:"venueAddress"`
	City         string `json:"city"`
	MapsUrl      string `json:"mapsUrl"`
	SortOrder    int32  `json:"sortOrder"`
}

type AgendaEventInput struct {
	EventLabel   string `json:"eventLabel"`
	TimeLabel    string `json:"timeLabel"`
	VenueName    string `json:"venueName"`
	VenueAddress string `json:"venueAddress"`
	City         string `json:"city"`
	MapsUrl      string `json:"mapsUrl"`
	SortOrder    int32  `json:"sortOrder"`
}

type RundownItemDTO struct {
	ID           uint64 `json:"id"`
	GroupLabel   string `json:"groupLabel"`
	TimeLabel    string `json:"timeLabel"`
	ActivityText string `json:"activityText"`
	SortOrder    int32  `json:"sortOrder"`
}

type RundownItemInput struct {
	GroupLabel   string `json:"groupLabel"`
	TimeLabel    string `json:"timeLabel"`
	ActivityText string `json:"activityText"`
	SortOrder    int32  `json:"sortOrder"`
}

type GalleryPhotoDTO struct {
	ID        uint64 `json:"id"`
	PhotoUrl  string `json:"photoUrl"`
	ThumbUrl  string `json:"thumbUrl"`
	SortOrder int32  `json:"sortOrder"`
}

type GalleryPhotoInput struct {
	PhotoUrl  string `json:"photoUrl"`
	ThumbUrl  string `json:"thumbUrl"`
	SortOrder int32  `json:"sortOrder"`
}

type LoveStoryChapterDTO struct {
	ID        uint64 `json:"id"`
	PhotoUrl  string `json:"photoUrl"`
	Title     string `json:"title"`
	Caption   string `json:"caption"`
	SortOrder int32  `json:"sortOrder"`
}

type LoveStoryChapterInput struct {
	PhotoUrl  string `json:"photoUrl"`
	Title     string `json:"title"`
	Caption   string `json:"caption"`
	SortOrder int32  `json:"sortOrder"`
}

type WeddingGiftBankDTO struct {
	ID            uint64 `json:"id"`
	BankName      string `json:"bankName"`
	AccountNumber string `json:"accountNumber"`
	AccountName   string `json:"accountName"`
	SortOrder     int32  `json:"sortOrder"`
}

type WeddingGiftBankInput struct {
	BankName      string `json:"bankName"`
	AccountNumber string `json:"accountNumber"`
	AccountName   string `json:"accountName"`
	SortOrder     int32  `json:"sortOrder"`
}

// SectionDTO - urutan `Order` yang dikembalikan endpoint PUBLIK selalu
// ter-normalisasi 1..N berurutan (PLAN.md §5.2), TIDAK sama dengan
// sort_order mentah di database (yang boleh bolong setelah ada yang
// di-disable). Endpoint ADMIN (ListSections) mengembalikan sort_order asli
// supaya urutan disable/enabled tetap terlihat penuh untuk diedit.
type SectionDTO struct {
	Key   string `json:"key"`
	Order int32  `json:"order"`
}

type SectionAdminDTO struct {
	Key       string `json:"key"`
	Label     string `json:"label"`
	IsEnabled bool   `json:"isEnabled"`
	SortOrder int32  `json:"sortOrder"`
}

type SectionUpdateInput struct {
	Key       string `json:"key"`
	IsEnabled bool   `json:"isEnabled"`
	SortOrder int32  `json:"sortOrder"`
}

// PublicInvitationDTO adalah kontrak GET /api/v1/public/invitation (PLAN.md §5.2).
type PublicInvitationDTO struct {
	Content           InvitationContentDTO  `json:"content"`
	Sections          []SectionDTO          `json:"sections"`
	AgendaEvents      []AgendaEventDTO      `json:"agendaEvents"`
	RundownItems      []RundownItemDTO      `json:"rundownItems"`
	GalleryPhotos     []GalleryPhotoDTO     `json:"galleryPhotos"`
	LoveStoryChapters []LoveStoryChapterDTO `json:"loveStoryChapters"`
	GiftBanks         []WeddingGiftBankDTO  `json:"giftBanks"`
}
