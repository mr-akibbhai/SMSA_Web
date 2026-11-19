import { useLanguage } from "./lib/i18n";
import { useEffect, useRef, useState, useId, lazy, Suspense } from "react";
import { X, Users, GraduationCap, CalendarDays, ShieldCheck, LogIn, LogOut, UserCircle, ArrowRight, Heart, Search, Clock, MapPin, KeyRound, Trash2, Edit, Plus, Save, Ban, RefreshCw, ChevronLeft, Layers, Image, Upload, CheckCircle, XCircle } from "lucide-react";
import { supabase } from "./lib/supabase";
import { useAppRoute } from "./lib/navigation";
import { LanguageToggle, FormAccessibility } from "./lib/i18n";
import { friendlyMessage, logDiagnostic } from "./lib/notifications";
import BatchEditor from "./components/BatchEditor";
import { AutoRail, AboutSlideshow } from "./components/Experience";
import { formatBatchName, validateImage, validatePhone, updateMemberProfile, deleteGalleryRecord } from "./lib/domain";
import { ImageUpload, useSiteContent, ContentManager, CommunityLinks, Carousel } from './components/ContentFeatures';
const managementComponent = name => lazy(() => import('./components/Management').then(module => ({default:module[name]})));
const DashboardNavigation = managementComponent('DashboardNavigation');
const DashboardOverview = managementComponent('DashboardOverview');
const AboutManager = managementComponent('AboutManager');
const SocialLinksManager = managementComponent('SocialLinksManager');
const navItems = ["Home", "About", "Events", "Alumni", "Committee"];
const emptyForm = {
  full_name: "",
  address: "",
  passing_year: "",
  batch: "",
  phone: "",
  blood_group: "",
  photo_url: "",
  bio: ""
};
const emptyEventForm = {
  title: "",
  description: "",
  event_date: "",
  image_url: "",
  enabled: true,
  location: ""
};
const emptyCommitteeForm = {
  name: "",
  position: "",
  batch: "",
  photo_url: "",
  introduction: "",
  committee_year: new Date().getFullYear(),
  is_current: true
};
export default function App() {
  const {
    t
  } = useLanguage();
  const content = useSiteContent();
  const accountLoad = useRef(0);
  const publicLoad = useRef(0);
  const accountUser = useRef(null);
  const authEpoch = useRef(0);
  const authAttempt = useRef(false);
  const [eventUploading, setEventUploading] = useState(false);
  const [committeeUploading, setCommitteeUploading] = useState(false);
  const [galleryFilter, setGalleryFilter] = useState("pending");
  const {
    route,
    go,
    back
  } = useAppRoute();
  const page = route.page;
  const setPage = page => go({
    page
  });
  const selectedBatch = route.batch;
  const setSelectedBatch = batch => go({
    page: 'Alumni',
    batch,
    gallery: null
  });
  const gallerySelection = route.gallery;
  const setGalleryBatch = gallery => go({
    page: 'Gallery',
    gallery
  });
  const search = route.search;
  const setSearch = search => go({
    search
  }, true);
  const [memberSearch, setMemberSearch] = useState('');
  const [activeSection, setActiveSection] = useState("Home");
  const navbarRef = useRef(null);
  const navRef = useRef(null);
  const scrollTarget = useRef(null);
  const publicView = ["Home", "About", "Events"].includes(page) || (page === "Alumni" && !selectedBatch);
  useEffect(() => {
    let frame;
    const update = () => {
      if (!publicView) return;
      const offset = (navbarRef.current?.offsetHeight || 80) + 24;
      let current = "Home";
      for (const name of navItems) {
        if (document.getElementById(name.toLowerCase())?.getBoundingClientRect().top <= offset) current = name;
      }
      if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2) current = "Alumni";
      setActiveSection(current);
    };
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    const resize = new ResizeObserver(() => {
      document.documentElement.style.setProperty("--navbar-height", (navbarRef.current?.offsetHeight || 80) + "px");
      onScroll();
    });
    if (navbarRef.current) resize.observe(navbarRef.current);
    window.addEventListener("scroll", onScroll, {
      passive: true
    });
    window.addEventListener("resize", onScroll);
    frame = requestAnimationFrame(() => {
      if (scrollTarget.current) {
        document.getElementById(scrollTarget.current.toLowerCase())?.scrollIntoView({
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"
        });
        scrollTarget.current = null;
      }
      update();
    });
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [publicView, page]);
  useEffect(() => {
    const nav = navRef.current;
    const item = nav?.querySelector('[aria-current="location"]');
    if (!nav || !item) return;
    nav.scrollTo({
      left: nav.scrollLeft + item.getBoundingClientRect().left - nav.getBoundingClientRect().left - (nav.clientWidth - item.offsetWidth) / 2,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"
    });
  }, [activeSection, publicView, page]);
  const [session, setSession] = useState(null);
  useEffect(() => {
    content.reload();
  }, [session?.user?.id]);
  const [profile, setProfile] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessageState] = useState("");
  function setMessage(value) {
    const safe = friendlyMessage(value);
    if (safe !== value) logDiagnostic(value);
    setMessageState(safe);
  }
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const authMode = route.authMode || "choose";
  const setAuthMode = authMode => go({
    authMode
  });
  const loginType = route.loginType || "member";
  const setLoginType = loginType => go({
    loginType
  });
  const [authLoading, setAuthLoading] = useState(false);
  const [alumni, setAlumni] = useState([]);
  const [events, setEvents] = useState([]);
  const [committee, setCommittee] = useState([]);
  const [members, setMembers] = useState([]);

  // BATCH SYSTEM
  const [batches, setBatches] = useState([]);
  const galleryBatch = batches.find(b => gallerySelection && (String(b.id) === String(gallerySelection.id) || formatBatchName(b.name) === formatBatchName(gallerySelection.name))) || (gallerySelection?.id ? gallerySelection : null);
  const [batchYear, setBatchYear] = useState("");
  const [batchLoading, setBatchLoading] = useState(false);
  const [showBatchForm, setShowBatchForm] = useState(false);

  // BATCH GALLERY
  const galleryRequest = useRef(0);
  const [galleryPhotos, setGalleryPhotos] = useState([]);
  const [pendingGallery, setPendingGallery] = useState([]);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [galleryUploading, setGalleryUploading] = useState(false);
  const [galleryFile, setGalleryFile] = useState(null);
  const [galleryCaption, setGalleryCaption] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [editingMember, setEditingMember] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);
  const [editingCommittee, setEditingCommittee] = useState(null);
  const [eventForm, setEventForm] = useState(emptyEventForm);
  const [committeeForm, setCommitteeForm] = useState(emptyCommitteeForm);
  useEffect(() => {
    if (galleryBatch?.id) loadGalleryPhotos(galleryBatch.id);
    return () => {
      galleryRequest.current++;
    };
  }, [galleryBatch?.id, session?.user?.id]);
  useEffect(() => {
    const close = e => {
      if (e.type === 'keydown' && e.key !== 'Escape') return;
      if (e.type === 'click' && e.target.closest('.navbar details')) return;
      document.querySelectorAll('.navbar details[open]').forEach(menu => menu.removeAttribute('open'));
    };
    document.addEventListener('click', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('click', close);
      document.removeEventListener('keydown', close);
    };
  }, []);
  useEffect(() => {
    if (route.editMember && !editingMember) {
      const member = members.find(m => m.id === route.editMember);
      if (member) setEditingMember({
        ...member,
        batch: formatBatchName(member.batch)
      });
    }
  }, [route.editMember, members]);
  // AUTH INITIALIZATION
  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      setMessage("Supabase configuration is missing.");
      return;
    }
    let mounted = true;
    async function initialize() {
      const epoch = authEpoch.current;
      const {
        data,
        error
      } = await supabase.auth.getSession();
      if (error) setMessage(error.message);
      if (mounted && epoch === authEpoch.current && data?.session) {
        setSession(data.session);
        await loadAccount(data.session.user);
      } else if (mounted && epoch === authEpoch.current) {
        setLoading(false);
      }
      if (mounted) {
        await Promise.all([loadPublicData(), loadBatches()]);
      }
    }
    initialize().catch(error => {
      if (mounted) {
        setMessage(error.message);
        setLoading(false);
      }
    });
    const {
      data: listener
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!mounted) return;
      if (["SIGNED_IN","SIGNED_OUT","USER_UPDATED","TOKEN_REFRESHED","PASSWORD_RECOVERY"].includes(event)) authEpoch.current++;
      if (event === "PASSWORD_RECOVERY") {
        setSession(newSession);
        setPage("ResetPassword");
        setLoading(false);
        return;
      }
      if (["SIGNED_IN","USER_UPDATED","TOKEN_REFRESHED"].includes(event) && newSession) {
        setSession(newSession);
        const epoch = authEpoch.current;
        setTimeout(() => {
          if (mounted && epoch === authEpoch.current && !authAttempt.current) loadAccount(newSession.user).catch(error => setMessage(error.message));
        }, 0);
      }
      if (event === "SIGNED_OUT") {
        accountLoad.current++;
        accountUser.current = null;
        setSession(null);
        setProfile(null);
        setForm(emptyForm);
        setIsAdmin(false);
        setMembers([]);
        setPendingGallery([]);
        setGalleryPhotos([]);
        setPage("Home");
        loadPublicData(); content.reload();
        setLoading(false);
      }
    });
    return () => {
      mounted = false;
      accountLoad.current++;
      listener.subscription.unsubscribe();
    };
  }, []);

  // PUBLIC DATA
  async function loadPublicData() {
    if (!supabase) return;
    const request = ++publicLoad.current;
    const [a, e, c] = await Promise.all([supabase.from("public_alumni").select("*"), supabase.from("events").select("*").order("event_date"), supabase.from("committee_members").select("*").order("name")]);
    if (request !== publicLoad.current) return;
    if (a.error) {
      console.error("Alumni Loading Error:", a.error);
    } else {
      setAlumni(a.data || []);
    }
    if (e.error) {
      console.error("Events Loading Error:", e.error);
    } else {
      setEvents(e.data || []);
    }
    if (c.error) {
      console.error("Committee Loading Error:", c.error);
    } else {
      setCommittee(c.data || []);
    }
  }
  // LOAD BATCHES
  async function loadBatches() {
    if (!supabase) return;
    setBatchLoading(true);
    try {
      const {
        data,
        error
      } = await supabase.from("batches").select("*").order("name", {
        ascending: true
      });
      if (error) throw error;
      setBatches(data || []);
    } catch (error) {
      setMessage("Could not load batches: " + error.message);
    } finally {
      setBatchLoading(false);
    }
  }

  // CREATE SIGNED URLS FOR PRIVATE GALLERY IMAGES
  async function addGalleryImageUrls(photos) {
    return Promise.all((photos || []).map(async photo => {
      const {
        data,
        error
      } = await supabase.storage.from("batch-gallery").createSignedUrl(photo.storage_path, 3600);
      return {
        ...photo,
        image_url: error ? null : data?.signedUrl || null
      };
    }));
  }

  // LOAD GALLERY PHOTOS
  async function loadGalleryPhotos(batchId) {
    if (!supabase || !batchId) return;
    const requestId = ++galleryRequest.current;
    setGalleryLoading(true);
    try {
      const {
        data,
        error
      } = await supabase.from("gallery_photos").select("*").eq("batch_id", batchId).order("created_at", {
        ascending: false
      });
      if (error) throw error;
      let enriched = data || [];
      if (enriched.length) {
        const names = await supabase.rpc('smsa_gallery_uploader_names', {
          photo_ids: enriched.map(photo => String(photo.id))
        });
        if (!names.error) enriched = enriched.map(photo => ({
          ...photo,
          uploader_name: names.data?.find(n => n.photo_id === String(photo.id))?.full_name
        }));
      }
      const photos = await addGalleryImageUrls(enriched);
      if (requestId === galleryRequest.current) setGalleryPhotos(photos);
    } catch (error) {
      setMessage("Gallery loading failed: " + error.message);
    } finally {
      if (requestId === galleryRequest.current) setGalleryLoading(false);
    }
  }

  // LOAD PENDING PHOTOS FOR ADMIN
  async function loadPendingGallery(adminAccess = isAdmin) {
    if (!supabase || !adminAccess) return;
    const request = accountLoad.current;
    try {
      const {
        data,
        error
      } = await supabase.from("gallery_photos").select("*").order("created_at", {
        ascending: false
      });
      if (error) throw error;
      const photos = await addGalleryImageUrls(data || []);
      if (request === accountLoad.current) setPendingGallery(photos);
    } catch (error) {
      setMessage("Pending gallery loading failed: " + error.message);
    }
  }

  // UPLOAD GALLERY PHOTO
  async function uploadGalleryPhoto(e) {
    e.preventDefault();
    if (!session || !profile) {
      setMessage("Please login first.");
      return;
    }
    if (!galleryBatch || !galleryFile) {
      setMessage("Please select a photo.");
      return;
    }
    const ownBatch = batches.find(batch => formatBatchName(batch.name) === formatBatchName(profile.batch) && batch.is_active && String(batch.id) === String(galleryBatch.id));
    if (!ownBatch || String(ownBatch.id) !== String(galleryBatch.id)) {
      setMessage("You can upload photos only to your own active batch.");
      return;
    }
    if (validateImage(galleryFile)) {
      setMessage(validateImage(galleryFile));
      return;
    }
    if (galleryFile.size > 10 * 1024 * 1024) {
      setMessage("Maximum image size is 10 MB.");
      return;
    }
    setGalleryUploading(true);
    setMessage("");
    let storagePath = null;
    let currentStage = "Checking photo limit";
    try {
      const {
        count,
        error: countError
      } = await supabase.from("gallery_photos").select("id", {
        count: "exact",
        head: true
      }).eq("batch_id", galleryBatch.id).eq("status", "approved");
      if (countError) throw countError;
      if ((count || 0) >= 100) {
        throw new Error("This batch has reached its 100 approved-photo limit.");
      }
      const safeFileName = galleryFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      storagePath = `${galleryBatch.id}/${session.user.id}/${crypto.randomUUID()}-${safeFileName}`;
      currentStage = "Uploading image to Supabase Storage";
      const {
        error: uploadError
      } = await supabase.storage.from("batch-gallery").upload(storagePath, galleryFile, {
        contentType: galleryFile.type,
        upsert: false
      });
      if (uploadError) throw uploadError;
      currentStage = "Saving photo information to gallery_photos";
      const {
        error: insertError
      } = await supabase.from("gallery_photos").insert({
        batch_id: galleryBatch.id,
        uploader_id: session.user.id,
        storage_path: storagePath,
        caption: galleryCaption.trim() || null,
        status: "pending"
      });
      if (insertError) {
        await supabase.storage.from("batch-gallery").remove([storagePath]);
        throw insertError;
      }
      currentStage = "Refreshing gallery";
      setGalleryFile(null);
      setGalleryCaption("");
      const fileInput = document.getElementById("gallery-file-input");
      if (fileInput) fileInput.value = "";
      setMessage("Photo submitted successfully. Waiting for Admin approval.");
      await loadGalleryPhotos(galleryBatch.id);
    } catch (error) {
      setMessage(`Photo upload failed at [${currentStage}]: ${error.message}`);
    } finally {
      setGalleryUploading(false);
    }
  }

  // ADMIN APPROVE / REJECT PHOTO
  async function reviewGalleryPhoto(photoId, status) {
    if (!isAdmin || !session || authLoading) return;
    setAuthLoading(true);
    try {
      const {
        error
      } = await supabase.from("gallery_photos").update({
        status,
        reviewed_at: new Date().toISOString(),
        reviewed_by: session.user.id
      }).eq("id", photoId);
      if (error) throw error;
      setMessage(status === "approved" ? "Photo approved successfully." : "Photo rejected successfully.");
      await Promise.all([loadPendingGallery(true), galleryBatch ? loadGalleryPhotos(galleryBatch.id) : Promise.resolve()]);
    } catch (error) {
      setMessage("Photo review failed: " + error.message);
    } finally {
      setAuthLoading(false);
    }
  }

  // ADMIN DELETE PHOTO
  async function deleteGalleryPhoto(photo) {
    if (!isAdmin || authLoading) return;
    if (!window.confirm(t('Permanently delete this photo?'))) return;
    setAuthLoading(true);
    try {
      // Remove the gallery reference first: a Storage failure must not leave a broken public card.
      const {
        cleanupError
      } = await deleteGalleryRecord(supabase, photo);
      if (cleanupError) {
        logDiagnostic(cleanupError);
        setMessage('Photo removed from the gallery. Image cleanup could not finish; please contact the administrator.');
      } else setMessage('Photo deleted successfully.');
      await Promise.all([loadPendingGallery(true), galleryBatch ? loadGalleryPhotos(galleryBatch.id) : Promise.resolve()]);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setAuthLoading(false);
    }
  }

  // LOAD ACCOUNT
  async function loadAccount(user) {
    if (!supabase || !user) return;
    const requestId = ++accountLoad.current;
    if (accountUser.current !== user.id) {
      setIsAdmin(false); setProfile(null); setMembers([]); setPendingGallery([]);
      accountUser.current = user.id;
    }
    setLoading(true);
    try {
      const [p, r] = await Promise.all([supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(), supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle()]);
      if (p.error) throw p.error;
      if (requestId !== accountLoad.current) return;
      const admin = r.data?.role === "admin";
      setIsAdmin(admin);
      setProfile(p.data || null);
      if (r.error) { setIsAdmin(false); throw r.error; }
      if (p.data) {
        setForm({
          ...emptyForm,
          ...Object.fromEntries(Object.keys(emptyForm).map(key => [key, p.data[key] ?? ""])),
          passing_year: p.data.passing_year || ""
        });
      } else {
        setForm({
          ...emptyForm,
          full_name: user.user_metadata?.full_name || ""
        });
      }
      if (admin) {
        await Promise.all([loadAdminData(), loadBatches(), loadPendingGallery(true), loadPublicData(), content.reload()]);
      } else {
        setMembers([]);
        setPendingGallery([]);
      }
    } catch (error) {
      if (requestId !== accountLoad.current) return;
      setMessage("Account loading error: " + error.message);
      throw error;
    } finally {
      if (requestId === accountLoad.current) setLoading(false);
    }
  }

  // ADMIN DATA
  async function loadAdminData() {
    if (!supabase) return;
    const request = accountLoad.current;
    const {
      data,
      error
    } = await supabase.from("profiles").select("*").order("created_at", {
      ascending: false
    });
    if (error) {
      setMessage("Could not load members: " + error.message);
      return;
    }
    if (request === accountLoad.current) setMembers(data || []);
  }

  // NAVIGATION
  function navigate(name) {
    if (name === "Admin" && !isAdmin) {
      setMessage("Admin access required.");
      return;
    }
    if (name === "Profile" && !session) {
      openLoginOptions();
      return;
    }
    if (navItems.includes(name)) {
      scrollTarget.current = name;
      if (publicView && page === name) {
        document.getElementById(name.toLowerCase())?.scrollIntoView({
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"
        });
        scrollTarget.current = null;
      }
    } else window.scrollTo({
      top: 0,
      behavior: "instant"
    });
    document.querySelectorAll(".navbar details[open]").forEach(menu => menu.removeAttribute("open"));
    setPage(name);
    setMessage("");
    go({
      batch: null,
      gallery: null,
      committee: null,
      search: "",
      panel: "overview",
      memberBatch: null,
      adminBatch: null,
      editMember: null
    });
    setShowBatchForm(false);
    if (name === "Gallery") {
      setGalleryBatch(null);
      setGalleryPhotos([]);
    }
    if (name === "Admin" && isAdmin) {
      loadPendingGallery(true);
    }
  }
  function openLoginOptions() {
    setLoginType("member");
    setAuthMode("choose");
    setPage("Login");
    setMessage("");
    setPassword("");
    setConfirmPassword("");
  }
  function openAdminLogin() {
    setLoginType("admin");
    setAuthMode("login");
    setPage("Login");
    setMessage("");
    setPassword("");
    setConfirmPassword("");
  }
  function openMemberLogin() {
    setLoginType("member");
    setAuthMode("login");
    setPage("Login");
    setMessage("");
    setPassword("");
    setConfirmPassword("");
  }
  function openMemberRegistration() {
    setLoginType("member");
    setAuthMode("signup");
    setPage("Login");
    setMessage("");
    setPassword("");
    setConfirmPassword("");
    loadBatches();
  }
  function updateForm(field, value) {
    setForm(old => ({
      ...old,
      [field]: value
    }));
  }

  // MEMBER REGISTRATION
  async function registerMember(e) {
    e.preventDefault();
    if (authAttempt.current) return;
    setMessage("");
    if (loginType !== "member") {
      setMessage("Only members can register.");
      return;
    }
    if (password.length < 6) {
      setMessage("Password must contain at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }
    if (!form.full_name.trim() || !form.batch) {
      setMessage("Full Name and Batch are required.");
      return;
    }
    if(!validatePhone(form.phone)){setMessage('Please enter a valid phone number.');return;}
    const selected = batches.find(batch => formatBatchName(batch.name) === formatBatchName(form.batch) && batch.is_active);
    if (!selected) {
      setMessage("Please select an active Batch.");
      return;
    }
    setAuthLoading(true);
    authAttempt.current = true;
    try {
      const {
        data,
        error
      } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: form.full_name.trim()
          }
        }
      });
      if (error) throw error;
      if (!data.user) throw new Error("Registration failed.");
      if (!data.session) {
        navigate("Home"); setPassword(""); setConfirmPassword("");
        setMessage("Account created. Check your email to confirm your account, then sign in and complete your profile.");
        return;
      }
      const {
        error: profileError
      } = await supabase.from("profiles").upsert({
        id: data.user.id,
        phone: form.phone || null,
        blood_group: form.blood_group || null,
        bio: form.bio || null,
        photo_url: form.photo_url || null,
        batch: formatBatchName(form.batch),
        full_name: form.full_name.trim(),
        address: (form.address || "").trim() || null,
        passing_year: profile ? profile.passing_year : Number(formatBatchName(form.batch).match(/\d{4}$/)?.[0]) || null
      });
      if (profileError) throw profileError;
      setPassword("");
      setConfirmPassword("");
      setSession(data.session);
      navigate("Home");
      await loadAccount(data.user);
      await loadPublicData();
      setMessage("Member registration successful.");
    } catch (error) {
      setMessage("Registration error: " + error.message);
    } finally {
      authAttempt.current = false;
      setAuthLoading(false);
    }
  }

  // LOGIN
  async function login(e) {
    e.preventDefault();
    if (authAttempt.current) return;
    authAttempt.current = true;
    setMessage("");
    setAuthLoading(true);
    try {
      const {
        data,
        error
      } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
      });
      if (error) throw error;
      const {
        data: roleData,
        error: roleError
      } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id).maybeSingle();
      if (roleError) throw roleError;
      const userIsAdmin = roleData?.role === "admin";
      if (loginType === "admin" && !userIsAdmin) {
        await supabase.auth.signOut();
        setSession(null);
        setProfile(null);
        setIsAdmin(false);
        setPage("Login");
        setMessage("Access denied. This account is not authorised as an Admin.");
        return;
      }
      if (loginType === "member" && userIsAdmin) {
        await supabase.auth.signOut();
        setSession(null);
        setProfile(null);
        setIsAdmin(false);
        setPage("Login");
        setMessage("This is an Admin account. Please use Admin Login.");
        return;
      }
      setSession(data.session);
      setPassword("");
      navigate("Home");
      await loadAccount(data.user);
      setMessage(userIsAdmin ? "Admin login successful." : "Member login successful.");
    } catch (error) {
      setMessage("Login failed: " + error.message);
    } finally {
      authAttempt.current = false;
      setAuthLoading(false);
    }
  }

  // FORGOT PASSWORD
  async function sendPasswordReset(e) {
    e.preventDefault();
    setMessage("");
    setAuthLoading(true);
    try {
      const {
        error
      } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin
      });
      if (error) throw error;
      setMessage("Password reset link sent. Check your email.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setAuthLoading(false);
    }
  }

  // UPDATE PASSWORD
  async function updatePassword(e) {
    e.preventDefault();
    setMessage("");
    if (password.length < 6) {
      setMessage("Password must contain at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }
    setAuthLoading(true);
    try {
      const {
        error
      } = await supabase.auth.updateUser({
        password
      });
      if (error) throw error;
      setPassword("");
      setConfirmPassword("");
      setMessage("Password updated successfully.");
      if (session) {
        await loadAccount(session.user);
        setPage("Profile");
        setMessage("Password updated successfully.");
      } else {
        setPage("Login");
      }
    } catch (error) {
      setMessage(error.message);
    } finally {
      setAuthLoading(false);
    }
  }

  // SAVE OWN PROFILE
  async function saveProfile(e) {
    e.preventDefault();
    if (!session) return;
    if (!form.full_name.trim() || !form.batch) {
      setMessage("Full Name and Batch are required.");
      return;
    }
    const currentBatch = profile?.batch;
    const selected = batches.find(batch => formatBatchName(batch.name) === formatBatchName(form.batch) && (batch.is_active || formatBatchName(batch.name) === formatBatchName(currentBatch)));
    if (!selected) {
      setMessage("Please select an active Batch.");
      return;
    }
    if (!validatePhone(form.phone)) {
      setMessage("Please enter a valid phone number.");
      return;
    }
    setAuthLoading(true);
    try {
      const {
        data,
        error
      } = await supabase.from("profiles").upsert({
        id: session.user.id,
        phone: form.phone || null,
        blood_group: form.blood_group || null,
        bio: form.bio || null,
        photo_url: form.photo_url || null,
        batch: formatBatchName(form.batch),
        full_name: form.full_name.trim(),
        address: (form.address || "").trim() || null,
        passing_year: profile ? profile.passing_year : Number(formatBatchName(form.batch).match(/\d{4}$/)?.[0]) || null
      }).select().single();
      if (error) throw error;
      setProfile(data);
      setForm(old => ({
        ...old,
        batch: formatBatchName(data.batch)
      }));
      setMessage("Profile saved successfully.");
      await loadPublicData();
    } catch (error) {
      setMessage("Profile save failed: " + error.message);
    } finally {
      setAuthLoading(false);
    }
  }

  // ADMIN: CREATE BATCH
  async function createBatch(e) {
    e.preventDefault();
    if (!isAdmin) {
      setMessage("Only Admin can create a new batch.");
      return;
    }
    const year = Number(batchYear);
    if (!Number.isInteger(year) || year < 6 || year > 99) {
      setMessage("Enter the last two digits of the year (06–99).");
      return;
    }
    const fullYear = 2000 + year;
    const batchName = `Dakhil-${fullYear}`;
    if (batches.some(batch => formatBatchName(batch.name).toLowerCase() === batchName.toLowerCase())) {
      setMessage(`${batchName} already exists.`);
      return;
    }
    setAuthLoading(true);
    try {
      const {
        error
      } = await supabase.from("batches").insert({
        name: batchName,
        is_active: true
      });
      if (error) {
        if (error.code === "23505") {
          throw new Error(`${batchName} already exists.`);
        }
        throw error;
      }
      setBatchYear("");
      setShowBatchForm(false);
      setMessage(`${batchName} created successfully.`);
      await loadBatches();
    } catch (error) {
      setMessage("Batch creation failed: " + error.message);
    } finally {
      setAuthLoading(false);
    }
  }

  // ADMIN: ACTIVATE / DEACTIVATE BATCH
  async function toggleBatch(batch) {
    if (!isAdmin) return;
    const nextStatus = !batch.is_active;
    const confirmText = nextStatus ? `${t("Activate")} ${formatBatchName(batch.name)}?` : `${t("Deactivate")} ${formatBatchName(batch.name)}? ${t("New members will no longer be able to select it.")}`;
    if (!window.confirm(t(confirmText))) return;
    try {
      const {
        error
      } = await supabase.from("batches").update({
        is_active: nextStatus
      }).eq("id", batch.id);
      if (error) throw error;
      setMessage(`${formatBatchName(batch.name)} ${nextStatus ? "activated" : "deactivated"} successfully.`);
      await loadBatches();
    } catch (error) {
      setMessage("Batch update failed: " + error.message);
    }
  }

  // ADMIN: EDIT MEMBER
  async function adminUpdateMember(e) {
    e.preventDefault();
    if (!isAdmin || !editingMember) return;
    if (!editingMember.full_name?.trim() || !editingMember.batch) {
      setMessage("Full Name and Batch are required.");
      return;
    }
    if (!editingMember.id) {
      setMessage('Please refresh the member list and try again.');
      return;
    }
    if (!validatePhone(editingMember.phone)) {
      setMessage('Please enter a valid phone number.');
      return;
    }
    setAuthLoading(true);
    try {
      await updateMemberProfile(supabase, editingMember);
      setEditingMember(null);
      back();
      setMessage("Member profile updated.");
      await loadAdminData();
      await loadPublicData();
      if (editingMember.id === session?.user.id) await loadAccount(session.user);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setAuthLoading(false);
    }
  }
  async function reviewMember(id, status) {
    if (!isAdmin || id === session?.user.id) return;
    setAuthLoading(true);
    try {
      const {
        error
      } = await supabase.from('profiles').update({
        approval_status: status
      }).eq('id', id).select('id').single();
      if (error) throw error;
      await loadAdminData();
      await loadPublicData();
      setMessage('Your changes have been saved.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setAuthLoading(false);
    }
  }
  // ADMIN: DELETE PROFILE DATA ONLY
  async function deleteMemberProfile(userId) {
    if (!isAdmin) return;
    if (userId === session?.user?.id) {
      setMessage("You cannot delete your own Admin profile here.");
      return;
    }
    if (!window.confirm(t("Delete this member's profile data? This does not delete the Auth account."))) return;
    const {
      error
    } = await supabase.from("profiles").delete().eq("id", userId);
    if (error) {
      setMessage(error.message);
    } else {
      setMessage("Profile data deleted. Auth account still exists.");
      await loadAdminData();
      await loadPublicData();
    }
  }

  // ADMIN: DISABLE / ENABLE / DELETE AUTH ACCOUNT
  async function manageAuthAccount(userId, action) {
    if (!isAdmin) return;
    if (userId === session?.user?.id) {
      setMessage("You cannot disable or delete your own Admin account.");
      return;
    }
    const confirmText = action === "delete" ? "Permanently delete this account? This action cannot be undone." : action === "ban" ? "Disable this member's login?" : "Re-enable this member's login?";
    if (!window.confirm(confirmText)) return;
    try {
      const {
        data,
        error
      } = await supabase.functions.invoke("admin-manage-user", {
        body: {
          user_id: userId,
          action
        }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setMessage(data?.message || "Account action completed.");
      await loadAdminData();
    } catch (error) {
      setMessage("Account action failed: " + error.message + ". Make sure the admin-manage-user Edge Function is deployed.");
    }
  }

  // ADMIN: EVENTS
  async function saveEvent(e) {
    e.preventDefault();
    if (!isAdmin || authLoading || eventUploading) return;
    setAuthLoading(true);
    try {
      const eventData = {
        ...eventForm,
        event_date: eventForm.event_date || null
      };
      const query = editingEvent ? supabase.from("events").update(eventData).eq("id", editingEvent) : supabase.from("events").insert(eventData);
      const {
        error
      } = await query;
      if (error) throw error;
      setEventForm(emptyEventForm);
      setEditingEvent(null);
      setMessage("Event saved.");
      await loadPublicData();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setAuthLoading(false);
    }
  }
  async function deleteEvent(id) {
    if (authLoading || eventUploading) return;
    if (!isAdmin || !window.confirm(t("Delete this event?"))) return;
    const {
      error
    } = await supabase.from("events").delete().eq("id", id);
    if (error) {
      setMessage(error.message);
    } else {
      setMessage("Event deleted.");
      await loadPublicData();
    }
  }

  // ADMIN: COMMITTEE
  async function saveCommittee(e) {
    e.preventDefault();
    if (!isAdmin || authLoading || committeeUploading) return;
    setAuthLoading(true);
    try {
      const query = editingCommittee ? supabase.from("committee_members").update(committeeForm).eq("id", editingCommittee) : supabase.from("committee_members").insert(committeeForm);
      const {
        error
      } = await query;
      if (error) throw error;
      setCommitteeForm(emptyCommitteeForm);
      setEditingCommittee(null);
      setMessage("Committee member saved.");
      await loadPublicData();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setAuthLoading(false);
    }
  }
  async function deleteCommittee(id) {
    if (authLoading || committeeUploading) return;
    if (!isAdmin || !window.confirm(t("Delete this committee member?"))) return;
    const {
      error
    } = await supabase.from("committee_members").delete().eq("id", id);
    if (error) {
      setMessage(error.message);
    } else {
      setMessage("Committee member deleted.");
      await loadPublicData();
    }
  }

  // LOGOUT
  async function logout() {
    accountLoad.current++;
    const {
      error
    } = await supabase.auth.signOut();
    if (error) {
      setMessage(error.message);
      return;
    }
    setSession(null);
    setProfile(null);
    setIsAdmin(false);
    setMembers([]);
    setPendingGallery([]);
    setGalleryPhotos([]);
    setForm(emptyForm);
    setPassword("");
    setConfirmPassword("");
    setEmail("");
    setLoginType("member");
    setAuthMode("choose");
    setSelectedBatch(null);
    setGalleryBatch(null);
    setPage("Home");
    setMessage("");
  }

  // BATCH NAMES: DAKHIL-2006 TO CURRENT YEAR
  const currentYear = new Date().getFullYear();
  const generatedBatchNames = Array.from({
    length: Math.max(0, currentYear - 2005)
  }, (_, index) => `Dakhil-${2006 + index}`);
  const alumniBatchNames = alumni.map(person => formatBatchName(person.batch)).filter(Boolean);
  const displayedBatchNames = [...new Set([...generatedBatchNames, ...batches.map(batch => formatBatchName(batch.name)), ...alumniBatchNames])].sort((a, b) => {
    const yearA = Number(a.match(/\d{4}$/)?.[0] || 0);
    const yearB = Number(b.match(/\d{4}$/)?.[0] || 0);
    return yearA - yearB;
  });
  const filteredBatchNames = displayedBatchNames.filter(name => name.toLowerCase().includes(search.toLowerCase()));
  const filteredAlumni = alumni.filter(person => `${person.full_name || ""} ${formatBatchName(person.batch)}`.toLowerCase().includes(search.toLowerCase()));
  const selectedBatchAlumni = filteredAlumni.filter(person => formatBatchName(person.batch) === formatBatchName(selectedBatch));
  return <div className="app" onInvalidCapture={e => e.target.setCustomValidity(t("Please complete this field correctly."))} onInputCapture={e => e.target.setCustomValidity?.("")}><FormAccessibility />
      <header className="navbar" ref={navbarRef}>
        <div className="nav-container">
          <button className="brand" onClick={() => navigate("Home")}>
            <span className="brand-icon">
              {content.items.find(i => i.kind === "official" && i.enabled)?.image_url ? <img className="brand-logo" src={content.items.find(i => i.kind === "official" && i.enabled).image_url} alt={t("SMSA logo")} /> : <GraduationCap size={27} />}
            </span>
            <span>
              <strong>{t("SMSA")}</strong>
              <small>{t("Same Mind Student Association")}</small>
            </span>
          </button>

          <nav className="nav-links" ref={navRef} aria-label={t("Main navigation")}>
            {navItems.map(item => <button key={item} aria-current={(publicView ? activeSection === item : page === item || item === 'Alumni' && page === 'Gallery') ? 'location' : undefined} className={(publicView ? activeSection === item : page === item || item === 'Alumni' && page === 'Gallery') ? 'nav-link active' : 'nav-link'} onClick={() => navigate(item)}>{t(item)}</button>)}

          </nav>
          <div className="account-control"><LanguageToggle />{session ? <details><summary aria-label={t("Open account options")}>{profile?.photo_url ? <img src={profile.photo_url} alt={t("My account")} /> : <UserCircle size={28} />}<span className="account-name">{profile?.full_name || session.user.user_metadata?.full_name || t(loading ? "Loading account..." : "My account")}</span></summary><div className="account-menu"><p className="account-menu-name">{profile?.full_name || session.user.user_metadata?.full_name || t("My account")}</p><button onClick={() => navigate("Profile")}>{t("My Profile")}</button>{isAdmin && <button onClick={() => navigate("Admin")}>{t("Admin Dashboard")}</button>}<button onClick={logout}>{t("Logout")}</button></div></details> : <button className="nav-login" onClick={openLoginOptions}><LogIn size={16} />{t("Login")}</button>}</div>
        </div>
      </header>

      <main>
        {message && <div className="message container" role="status">
            {t(message)}
            <button aria-label={t("Dismiss message")} onClick={() => setMessage("")}>
              <X size={16} />
            </button>
          </div>}

        {/* HOME */}
        {publicView && <>
            <section id="home" className="hero">
              <div className="hero-content">
                <span className="eyebrow">{t("WELCOME TO OUR ALUMNI COMMUNITY")}</span>

                <h1>{t("Once a Student,")}<br />
                  <span>{t("Always a Family.")}</span>
                </h1>

                <p>{t("Connecting the past, celebrating the present, and building the future of our beloved institution.")}</p>

                <div className="hero-actions">
                  <button className="btn-primary" onClick={openMemberRegistration}>{t("Join Our Community")}<ArrowRight size={18} />
                  </button>

                  <button className="btn-outline" onClick={() => navigate("Alumni")}>{t("Explore Alumni")}</button>
                </div>
              </div>

              <div className="hero-art">
                <div className="hero-circle">
                  <GraduationCap size={105} strokeWidth={1.2} />
                  <span>{t("SMSA")}</span>
                </div>
              </div>
            </section>
            <Carousel items={content.items} />

            <section className="stats container">
              <div className="stat-card">
                <Users size={27} />
                <strong>{alumni.length}{t("+")}</strong>
                <span>{t("Registered Alumni")}</span>
              </div>

              <div className="stat-card">
                <CalendarDays size={27} />
                <strong>{events.filter(event => event.enabled !== false).length}{t("+")}</strong>
                <span>{t("Community Events")}</span>
              </div>

              <div className="stat-card">
                <Heart size={27} />
                <strong>{t("One")}</strong>
                <span>{t("United Community")}</span>
              </div>
            </section>


          </>}

        {/* ABOUT */}
        {publicView && <section id="about" className="page-section container">
            <PageHeading label={t("ABOUT SMSA")} title={content.items.find(i => i.kind === 'about' && i.key === 'story' && i.enabled)?.title || t("Our Story")} />
            {content.error && <div role="status"><p>{t(content.error)}</p><button className="btn-outline" onClick={content.reload}>{t('Retry additional content')}</button></div>}
            <div className="about-layout"><div className="about-copy"><span className="eyebrow">{t('TOGETHER ACROSS GENERATIONS')}</span><h2>{t('Same Mind Student Association')}</h2><p className="preserve-lines">{content.items.find(i => i.kind === 'about' && i.key === 'story' && i.enabled)?.description || content.items.find(i => i.kind === 'official' && i.enabled)?.description || t('SMSA is an alumni community for former students of Sakhipur Thana Sadar Dakhil Madrasah. Our purpose is to maintain lifelong connections, bring former classmates together, and create opportunities to support one another.')}</p><p>{t('No matter when we graduated or where life has taken us, we share a common history and a lasting connection.')}</p></div><AboutSlideshow items={content.items} /></div>
          </section>}

        {/* EVENTS */}
        {publicView && <section id="events" className="page-section container">
            <PageHeading label={t("STAY CONNECTED")} title={t("Events & Announcements")} />

            <div className="event-grid">
              {events.filter(event => event.enabled !== false).map(event => <article className="event-card" key={event.id}>
                  <div className="event-icon">
                    <CalendarDays size={28} />
                  </div>

                  {event.image_url && <img className="event-image" src={event.image_url} alt={event.title} />}<h3>{event.title}</h3>
                  <p>{event.description}</p>

                  {event.event_date && <span>
                      <Clock size={15} /> {event.event_date}
                    </span>}

                  {event.location && <span>
                      <MapPin size={15} /> {event.location}
                    </span>}
                </article>)}

              {events.filter(event => event.enabled !== false).length === 0 && <p className="empty-state">{t("No events have been published yet.")}</p>}
            </div>
          </section>}

        {/* ALUMNI */}
        {(publicView || page === "Alumni") && <section id="alumni" className="page-section container">
            <PageHeading label={t("OUR NETWORK")} title={selectedBatch ? formatBatchName(selectedBatch) : t("Our Batches")} />

            {!selectedBatch && <>
                <div className="alumni-top-actions">
                  <div className="search-box">
                    <Search size={19} />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t("Search by batch name...")} />
                  </div>

                  {isAdmin && <button type="button" className="btn-primary add-batch-button" onClick={() => setShowBatchForm(!showBatchForm)}>
                      <Plus size={18} />{t("Add a New Batch")}</button>}
                </div>

                {isAdmin && showBatchForm && <div className="content-card add-batch-panel">
                    <h3>
                      <Layers size={20} />{t("Add a New Batch")}</h3>

                    <p>{t("Enter the last two digits of the year. Example: 27 will create Dakhil-2027.")}</p>

                    <form hidden={!!route.adminBatch} onSubmit={createBatch}>
                      <label>{t("Batch Year (06\u201399)")}</label>
                      <input type="number" min="6" max="99" required placeholder={t("Example: 27")} value={batchYear} onChange={e => setBatchYear(e.target.value)} />

                      <div className="hero-actions">
                        <button className="btn-primary" disabled={authLoading}>
                          <Plus size={17} />
                          {authLoading ? t("Creating...") : t("Create Batch")}
                        </button>

                        <button type="button" className="btn-outline" onClick={() => {
                  setShowBatchForm(false);
                  setBatchYear("");
                }}>{t("Cancel")}</button>
                      </div>
                    </form>
                  </div>}
              </>}

            {selectedBatch ? <>
                <button type="button" className="btn-outline" style={{
            marginBottom: 24
          }} onClick={back}>
                  <ChevronLeft size={17} />{t("Back")}</button>

                <button className="btn-primary batch-gallery-link" onClick={() => {
            const batch = batches.find(b => formatBatchName(b.name) === formatBatchName(selectedBatch));
            if (!batch) {
              setMessage('This batch gallery is not available yet.');
              return;
            }
            go({
              page: 'Gallery',
              gallery: batch,
              batch: selectedBatch
            });
          }}><Image size={20} />{t("Batch Gallery")}</button>
                  <p className="preserve-lines">{content.items.find(i => i.kind === 'batch' && formatBatchName(i.key) === formatBatchName(selectedBatch) && i.enabled)?.description}</p>
                <div className="search-box">
                  <Search size={19} />
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t("Search alumni by name...")} />
                </div>

                <div className="alumni-grid">
                  {selectedBatchAlumni.map(person => <div className="alumni-card" key={person.id}>
                      <div className="avatar">
                        {person.photo_url ? <img src={person.photo_url} alt={person.full_name} /> : <UserCircle size={48} />}
                      </div>

                      <h3>{person.full_name}</h3>
                      <p>{t("Batch:") + " "}{formatBatchName(person.batch) || t("Not specified")}</p>
                    </div>)}

                  {selectedBatchAlumni.length === 0 && <p className="empty-state">{t("No alumni found in")}{formatBatchName(selectedBatch)}{t(".")}</p>}
                </div>
              </> : <AutoRail label={t("Available batches")}>
                {batchLoading ? <p className="empty-state">{t("Loading batches...")}</p> : filteredBatchNames.map(batchName => {
            const count = alumni.filter(person => formatBatchName(person.batch) === formatBatchName(batchName)).length;
            return <button type="button" className="batch-card" key={batchName} onClick={() => {
              setSelectedBatch(batchName);
              setSearch("");
            }}>
                        {content.items.find(i => i.kind === 'batch' && formatBatchName(i.key) === formatBatchName(batchName) && i.enabled)?.image_url && <img className="batch-cover" src={content.items.find(i => i.kind === 'batch' && formatBatchName(i.key) === formatBatchName(batchName) && i.enabled).image_url} alt={batchName} />}
                        <div className="batch-card-icon">
                          <GraduationCap size={30} />
                        </div>

                        <h3>{formatBatchName(batchName)}</h3>
                        <p>
                          {count} {count === 1 ? t("Alumnus") : t("Alumni")}
                        </p>

                        <span>{t("Explore Batch")}<ArrowRight size={16} />
                        </span>
                      </button>;
          })}

                {!batchLoading && filteredBatchNames.length === 0 && <p className="empty-state">{t("No batches found.")}</p>}
              </AutoRail>}
          </section>}

        {/* BATCH GALLERY */}
        {page === "Gallery" && <section id="gallery" className="page-section container">
            <PageHeading label={t("MEMORIES TOGETHER")} title={galleryBatch ? `${formatBatchName(galleryBatch.name)} ${t("Gallery")}` : t("Batch Gallery")} />

            {!galleryBatch ? <>
                <p className="gallery-intro">{t("Explore memories shared by our alumni, batch by batch.")}</p>

                {batchLoading ? <p className="empty-state">{t("Loading batches...")}</p> : <div className="batch-grid">
                    {batches.filter(batch => batch.is_active).map(batch => <button type="button" className="batch-card" key={batch.id} onClick={() => {
              setGalleryBatch(batch);
              setGalleryPhotos([]);
            }}>
                          <div className="batch-card-icon">
                            <Image size={30} />
                          </div>

                          <h3>{formatBatchName(batch.name)}</h3>
                          <p>{t("Batch memories")}</p>

                          <span>{t("Open Gallery")}<ArrowRight size={16} />
                          </span>
                        </button>)}

                    {batches.filter(batch => batch.is_active).length === 0 && <p className="empty-state">{t("No active batches found.")}</p>}
                  </div>}
              </> : <>
                <button type="button" className="btn-outline" style={{
            marginBottom: 24
          }} onClick={back}>
                  <ChevronLeft size={17} />{t("Back")}</button>

                {session && profile && formatBatchName(profile.batch) === formatBatchName(galleryBatch.name) && galleryBatch.is_active && <div className="content-card gallery-upload-panel">
                      <h3>
                        <Upload size={21} />{t("Upload a Photo")}</h3>

                      <p>{t("Upload a memory from your batch. Your photo will appear in the public gallery after Admin approval.")}</p>

                      <form onSubmit={uploadGalleryPhoto}>
                        <label>{t("Select Photo")}</label>
                        <input id="gallery-file-input" type="file" accept="image/jpeg,image/png,image/webp" required onChange={e => setGalleryFile(e.target.files?.[0] || null)} />

                        <label>{t("Caption (Optional)")}</label>
                        <input type="text" value={galleryCaption} maxLength={200} placeholder={t("Write a caption for your photo...")} onChange={e => setGalleryCaption(e.target.value)} />

                        <button className="btn-primary" disabled={galleryUploading || !galleryFile}>
                          <Upload size={17} />
                          {galleryUploading ? t("Uploading...") : t("Submit Photo")}
                        </button>
                      </form>
                    </div>}

                {!session && <div className="content-card gallery-login-notice">
                    <p>{t("Login to upload photos from your own batch.")}</p>
                    <button className="btn-primary" onClick={openLoginOptions}>
                      <LogIn size={17} />{t("Login")}</button>
                  </div>}

                {session && profile && formatBatchName(profile.batch) !== formatBatchName(galleryBatch.name) && <div className="content-card gallery-login-notice">
                      <p>{t("You can upload photos only to your own batch:")}{" "}{formatBatchName(profile.batch)}{t(".")}</p>
                    </div>}

                <div className="gallery-grid">
                  {galleryLoading ? <p className="empty-state">{t("Loading photos...")}</p> : galleryPhotos.filter(photo => photo.status === "approved" || photo.uploader_id === session?.user?.id || isAdmin).map(photo => <article className="gallery-card" key={photo.id}>
                          {photo.image_url ? <img className="gallery-image" src={photo.image_url} alt={photo.caption || t("Batch memory")} /> : <div className="gallery-image gallery-image-empty">
                              <Image size={35} />
                              <span>{t("Image unavailable")}</span>
                            </div>}

                          <div className="gallery-card-content"><strong>{photo.uploader_name || (isAdmin ? members.find(member => member.id === photo.uploader_id)?.full_name : null) || alumni.find(member => member.id === photo.uploader_id)?.full_name || (photo.uploader_id === session?.user.id ? profile?.full_name : null) || t("Member")}</strong>
                            {photo.caption && <p>{photo.caption}</p>}

                            {photo.status !== "approved" && <span className={`gallery-status ${photo.status}`}>
                                {photo.status === "pending" ? t("Waiting for approval") : t("Rejected")}
                              </span>}

                            {isAdmin && <div className="gallery-admin-actions">
                                {photo.status === "pending" && <>
                                    <button type="button" className="approve-btn" onClick={() => reviewGalleryPhoto(photo.id, "approved")}>
                                      <CheckCircle size={14} />{t("Approve")}</button>

                                    <button type="button" className="reject-btn" onClick={() => reviewGalleryPhoto(photo.id, "rejected")}>
                                      <XCircle size={14} />{t("Reject")}</button>
                                  </>}

                                <button type="button" className="reject-btn" onClick={() => deleteGalleryPhoto(photo)}>
                                  <Trash2 size={14} />{t("Delete")}</button>
                              </div>}
                          </div>
                        </article>)}

                  {!galleryLoading && galleryPhotos.filter(photo => photo.status === "approved" || photo.uploader_id === session?.user?.id || isAdmin).length === 0 && <p className="empty-state">{t("No approved photos in this batch yet.")}</p>}
                </div>
              </>}
          </section>}

        {/* COMMITTEE */}
        {page === "Committee" && <section id="committee" className="page-section container">
            <PageHeading label={t("LEADERSHIP")} title={t("Our Executive Committee")} />

            {committee.length === 0 && <p className="empty-state">{t("Committee information will be published here.")}</p>}{!route.committee ? <AutoRail label={t("Committee groups")}>{[...new Set(committee.map(m => m.is_current !== false ? 'current' : String(m.committee_year)).filter(y => y !== 'null' && y !== 'undefined'))].map(group => <button className="batch-card" key={group} onClick={() => go({
            committee: group
          })}><ShieldCheck size={35} /><h3>{group === 'current' ? t("Current Committee") : t('Committee of') + ' ' + group}</h3><p>{t("View committee members")}</p></button>)}</AutoRail> : <><button className="btn-outline" onClick={back}>{t("Back")}</button><h2>{route.committee === 'current' ? t("Current Committee") : t('Committee of') + ' ' + route.committee}</h2><div className="committee-grid">{committee.filter(m => route.committee === 'current' ? m.is_current !== false : m.is_current === false && String(m.committee_year) === route.committee).map(m => <article className="committee-card" key={m.id}>{m.photo_url && <img className="image-preview" src={m.photo_url} alt={m.name} />}<h3>{m.name}</h3><strong>{m.position}</strong><p>{m.batch}</p><p>{m.introduction}</p><small>{m.committee_year}</small></article>)}</div></>}

          </section>}

        {/* LOGIN AND REGISTRATION */}
        {page === "Login" && <section className="auth-section">
            <div className="auth-card">
              <div className="auth-icon">
                {authMode === "choose" ? <LogIn size={30} /> : loginType === "admin" ? <ShieldCheck size={30} /> : <GraduationCap size={30} />}
              </div>

              <span className="eyebrow">
                {authMode === "choose" ? t("WELCOME TO SMSA") : loginType === "admin" ? t("SMSA ADMINISTRATION") : t("SMSA MEMBER ACCOUNT")}
              </span>

              {authMode === "choose" && <>
                  <h2>{t("Welcome Back")}</h2>
                  <p>{t("Please select your account type to continue.")}</p>

                  <div className="login-options">
                    <button type="button" className="login-option" onClick={openMemberLogin}>
                      <Users size={27} />
                      <span>
                        <strong>{t("Member Login")}</strong>
                        <small>{t("Login to your member account")}</small>
                      </span>
                      <ArrowRight size={19} />
                    </button>

                    <button type="button" className="login-option" onClick={openAdminLogin}>
                      <ShieldCheck size={27} />
                      <span>
                        <strong>{t("Admin Login")}</strong>
                        <small>{t("Login to the Admin Dashboard")}</small>
                      </span>
                      <ArrowRight size={19} />
                    </button>
                  </div>

                  <p className="auth-switch">{t("Don't have an account?")}{" "}
                    <button onClick={openMemberRegistration}>{t("Register Now")}</button>
                  </p>
                </>}

              {authMode === "login" && <>
                  <h2>
                    {loginType === "admin" ? t("Admin Login") : t("Member Login")}
                  </h2>

                  <p>
                    {loginType === "admin" ? t("Login using your authorised Admin account.") : t("Login using your registered email and password.")}
                  </p>

                  <form onSubmit={login}>
                    <label>{t("Email Address")}</label>
                    <input type="email" required value={email} placeholder={t("you@example.com")} onChange={e => setEmail(e.target.value)} />

                    <label>{t("Password")}</label>
                    <input type="password" required value={password} placeholder={t("Enter your password")} onChange={e => setPassword(e.target.value)} />

                    <button className="btn-primary full-width" disabled={authLoading}>
                      {authLoading ? t("Please wait...") : t("Login")}
                      <ArrowRight size={17} />
                    </button>
                  </form>

                  <button className="text-button" onClick={() => {
              setAuthMode("forgot");
              setMessage("");
            }}>{t("Forgot Password?")}</button>

                  {loginType === "member" && <p className="auth-switch">{t("Don't have an account?")}{" "}
                      <button onClick={openMemberRegistration}>{t("Register Now")}</button>
                    </p>}

                  <div className="auth-note">
                    <ShieldCheck size={16} />
                    {loginType === "admin" ? t("Restricted to authorised Admin accounts only.") : t("Member accounts cannot access the Admin Dashboard.")}
                  </div>

                  <button type="button" className="text-button" onClick={openLoginOptions}>{t("Back to Login Options")}</button>
                </>}

              {authMode === "signup" && loginType === "member" && <>
                  <h2>{t("Create Member Account")}</h2>
                  <p>{t("Fill in your information to join SMSA.")}</p>

                  <form onSubmit={registerMember}>
                    <label>{t("Full Name")}</label>
                    <input required value={form.full_name} onChange={e => updateForm("full_name", e.target.value)} />

                    <label>{t("Address (Optional)")}</label>
                    <input value={form.address} onChange={e => updateForm("address", e.target.value)} placeholder={t("Your address")} />

                    <label>{t("Batch")}</label>
                    <BatchSelect batches={batches} value={form.batch} onChange={value => updateForm("batch", value)} required />

                    <label>{t("Phone Number")}</label>
                    <input value={form.phone} onChange={e => updateForm("phone", e.target.value)} />

                    <label>{t("Blood Group")}</label>
                    <select value={form.blood_group} onChange={e => updateForm("blood_group", e.target.value)}>
                      <option value="">{t("Select blood group")}</option>
                      {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map(g => <option key={g} value={g}>{g}</option>)}
                    </select>

                    <label>{t("Short Bio")}</label>
                    <textarea value={form.bio} onChange={e => updateForm("bio", e.target.value)} placeholder={t("Tell us about yourself...")} />

                    <label>{t("Email Address")}</label>
                    <input type="email" required value={email} placeholder={t("you@example.com")} onChange={e => setEmail(e.target.value)} />

                    <label>{t("Password")}</label>
                    <input type="password" required minLength={6} value={password} placeholder={t("At least 6 characters")} onChange={e => setPassword(e.target.value)} />

                    <label>{t("Confirm Password")}</label>
                    <input type="password" required minLength={6} value={confirmPassword} placeholder={t("Enter password again")} onChange={e => setConfirmPassword(e.target.value)} />

                    <button className="btn-primary full-width" disabled={authLoading || batchLoading}>
                      {authLoading ? t("Creating account...") : t("Register")}
                      <ArrowRight size={17} />
                    </button>
                  </form>

                  <p className="auth-switch">{t("Already registered?")}{" "}
                    <button onClick={() => {
                setLoginType("member");
                setAuthMode("login");
                setMessage("");
              }}>{t("Login")}</button>
                  </p>
                </>}

              {authMode === "forgot" && <>
                  <h2>{t("Forgot Password?")}</h2>
                  <p>{t("Enter your email to receive a password reset link.")}</p>

                  <form onSubmit={sendPasswordReset}>
                    <label>{t("Email Address")}</label>
                    <input type="email" required value={email} onChange={e => setEmail(e.target.value)} />

                    <button className="btn-primary full-width" disabled={authLoading}>
                      {authLoading ? t("Sending...") : t("Send Reset Link")}
                    </button>
                  </form>

                  <button className="text-button" onClick={() => {
              setAuthMode("login");
              setMessage("");
            }}>{t("Back to")}{loginType === "admin" ? t("Admin") : t("Member")}{t("Login")}</button>
                </>}
            </div>
          </section>}

        {/* RESET PASSWORD */}
        {page === "ResetPassword" && <section className="auth-section">
            <div className="auth-card">
              <div className="auth-icon">
                <KeyRound size={30} />
              </div>

              <h2>{t("Create New Password")}</h2>

              <form onSubmit={updatePassword}>
                <label>{t("New Password")}</label>
                <input type="password" minLength={6} required value={password} onChange={e => setPassword(e.target.value)} />

                <label>{t("Confirm New Password")}</label>
                <input type="password" minLength={6} required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />

                <button className="btn-primary full-width" disabled={authLoading}>{t("Update Password")}</button>
              </form>
            </div>
          </section>}

        {page === "Profile" && !session && <section className="page-section container"><button className="btn-primary" onClick={openLoginOptions}>{t("Login")}</button></section>}
        {/* MEMBER PROFILE */}
        {page === "Profile" && session && <section className="page-section container">
            <PageHeading label={t("MEMBER ACCOUNT")} title={t("My Profile")} />

            {loading ? <p>{t("Loading account...")}</p> : <form className="profile-form content-card" onSubmit={saveProfile}>
                <h3>{t("Personal Information")}</h3>{form.photo_url && <img className="image-preview profile-photo" src={form.photo_url} alt={t("My profile")} />}<ImageUpload userId={session?.user.id} onUploaded={url => updateForm("photo_url", url)} />

                <div className="form-grid">
                  <FormField label={t("Full Name")} value={form.full_name} onChange={v => updateForm("full_name", v)} required />

                  <FormField label={t("Address (Optional)")} value={form.address} onChange={v => updateForm("address", v)} />

                  <div className="field">
                    <label>{t("Batch")}</label>
                    <BatchSelect batches={batches} value={form.batch} onChange={value => updateForm("batch", value)} includeInactive required />
                  </div>

                  <FormField label={t("Phone Number")} value={form.phone} onChange={v => updateForm("phone", v)} />

                  <div className="field">
                    <label>{t("Blood Group")}</label>
                    <select value={form.blood_group} onChange={e => updateForm("blood_group", e.target.value)}>
                      <option value="">{t("Select blood group")}</option>
                      {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>

                  <div className="field full-field">
                    <label>{t("Short Bio")}</label>
                    <textarea value={form.bio} onChange={e => updateForm("bio", e.target.value)} />
                  </div>
                </div>

                <button className="btn-primary" disabled={authLoading}>
                  <Save size={17} />{t("Save Profile")}</button>
              </form>}
          </section>}

        {/* ADMIN DASHBOARD */}
        {page === "Admin" && <section className="page-section container">
            <PageHeading label={t("ADMINISTRATION")} title={t("Admin Dashboard")} />

            <Suspense fallback={<p role="status">{t("Loading management...")}</p>}>{!isAdmin ? <div className="content-card">
                <ShieldCheck size={35} />
                <h3>{t("Admin access required")}</h3>
              </div> : <>
                <div className="admin-intro"><p>{t("Manage your association")}</p><h2>{t("SMSA Control Centre")}</h2></div>
                <DashboardNavigation panel={route.panel} onSelect={panel => go({panel,memberBatch:null,adminBatch:null,editMember:null})} />
                {route.panel === 'overview' && <DashboardOverview onSelect={panel => go({panel,memberBatch:null,adminBatch:null})} />}
                {route.panel === 'about' && <AboutManager content={content} userId={session?.user.id} />}
                {route.panel === 'social' && <SocialLinksManager content={content} />}
                {route.panel === 'content' && <ContentManager content={content} userId={session?.user.id} batchNames={displayedBatchNames} kinds={['official','carousel']} />}

                <div hidden={route.panel !== "batches"} className="admin-section admin-batches">{/* BATCH MANAGEMENT */}
                <div className="content-card">
                  <h3>
                    <Layers size={21} style={{
                  verticalAlign: "middle"
                }} />{" "}{t("Batch Management (")}{batches.length}{t(")")}</h3>

                  <p>{t("Enter the last two digits of the year to create a batch. Example: 27 creates Dakhil-2027.")}</p>

                  <form hidden={!!route.adminBatch} onSubmit={createBatch}>
                    <label>{t("New Batch Year (06\u201399)")}</label>
                    <input type="number" min="6" max="99" required placeholder={t("Example: 27")} value={batchYear} onChange={e => setBatchYear(e.target.value)} />

                    <button className="btn-primary" disabled={authLoading}>
                      <Plus size={17} />
                      {authLoading ? t("Creating...") : t("Create Batch")}
                    </button>
                  </form>

                  {route.adminBatch && batches.find(b => String(b.id) === route.adminBatch) && <BatchEditor key={route.adminBatch} batch={batches.find(b => String(b.id) === route.adminBatch)} onSaved={loadBatches} onBack={back} />}
                  <div className="batch-management-grid" hidden={!!route.adminBatch} style={{
                marginTop: 24
              }}>
                    <h3>{t("All Batches")}</h3>

                    {batchLoading ? <p>{t("Loading batches...")}</p> : batches.length === 0 ? <p className="empty-state">{t("No batches found.")}</p> : Array.from(new Map(batches.map(batch => [formatBatchName(batch.name), batch])).values()).map(batch => <div className="pending-row batch-admin-card" key={batch.id}>
                          <div>
                            <strong>{formatBatchName(batch.name)}</strong>
                            <span>
                              {batch.is_active ? t("Active") : t("Inactive")}
                            </span>
                          </div>

                          <div className="pending-actions"><button className="approve-btn" onClick={() => go({
                      adminBatch: String(batch.id)
                    })}>{t("Edit Batch")}</button>
                            <button type="button" className={batch.is_active ? "reject-btn" : "approve-btn"} onClick={() => toggleBatch(batch)}>
                              {batch.is_active ? <>
                                  <Ban size={14} />{t("Deactivate")}</> : <>
                                  <RefreshCw size={14} />{t("Activate")}</>}
                            </button>
                          </div>
                        </div>)}
                  </div>
                </div>



                {route.panel === 'batches' && <ContentManager content={content} userId={session?.user.id} batchNames={displayedBatchNames} kinds={['batch']} />}
                </div><div hidden={route.panel !== "gallery"} className="admin-section admin-gallery">{/* GALLERY APPROVAL */}
                <div className="content-card" style={{
              marginTop: 24
            }}>
                  <h3>
                    <Image size={21} style={{
                  verticalAlign: "middle"
                }} />{" "}{t("Gallery Management (")}{pendingGallery.filter(photo => galleryFilter === "all" || photo.status === galleryFilter).length}{t(")")}</h3>

                  <p>{t("Review submitted photos. Approved photos will be visible to everyone in the Gallery.")}</p>

                  <button type="button" className="btn-outline" onClick={() => loadPendingGallery(true)} style={{
                marginBottom: 20
              }}>
                    <RefreshCw size={16} />{t("Refresh photos")}</button>

                  <label>{t('Photo status')}<select value={galleryFilter} onChange={e => setGalleryFilter(e.target.value)}>{['pending','approved','rejected','all'].map(status => <option key={status} value={status}>{t(status)}</option>)}</select></label>
                  {pendingGallery.filter(photo => galleryFilter === 'all' || photo.status === galleryFilter).length === 0 ? <p className="empty-state">{t("No photos with this status.")}</p> : <div className="gallery-grid">
                      {pendingGallery.filter(photo => galleryFilter === 'all' || photo.status === galleryFilter).map(photo => {
                  const uploader = members.find(member => member.id === photo.uploader_id);
                  const photoBatch = batches.find(batch => String(batch.id) === String(photo.batch_id));
                  return <article className="gallery-card" key={photo.id}>
                            {photo.image_url ? <img className="gallery-image" src={photo.image_url} alt={photo.caption || t("Pending photo")} /> : <div className="gallery-image gallery-image-empty">
                                <Image size={35} />
                                <span>{t("Image unavailable")}</span>
                              </div>}

                            <div className="gallery-card-content">
                              <strong>
                                {uploader?.full_name || photo.uploader_name || t("Unknown member")}
                              </strong>

                              <span>
                                {photoBatch ? formatBatchName(photoBatch.name) : t("Batch unavailable")}
                              </span>

                              <p>{photo.caption || t("No caption")}</p><span className={"gallery-status " + photo.status}>{t(photo.status)}</span>

                              <div className="gallery-admin-actions">
                                <button type="button" className="approve-btn" onClick={() => reviewGalleryPhoto(photo.id, "approved")}>
                                  <CheckCircle size={14} />{t("Approve")}</button>

                                <button type="button" className="reject-btn" onClick={() => reviewGalleryPhoto(photo.id, "rejected")}>
                                  <XCircle size={14} />{t("Reject")}</button>

                                <button type="button" className="reject-btn" onClick={() => deleteGalleryPhoto(photo)}>
                                  <Trash2 size={14} />{t("Delete")}</button>
                              </div>
                            </div>
                          </article>;
                })}
                    </div>}
                </div>



                </div><div hidden={route.panel !== "members"} className="admin-section admin-members">{/* MEMBER MANAGEMENT */}
                <div className="content-card" style={{
              marginTop: 24
            }} hidden={!!route.editMember}>
                  <h3>{t("Member Management (")}{members.length}{t(")")}</h3>
                  <p>{t("Admin can edit member data and manage account access.")}</p>

                  {!route.memberBatch ? <div className="batch-grid">{[...new Set(members.map(m => formatBatchName(m.batch) || t("Unassigned")))].sort().map(batch => <button className="batch-card" key={batch} onClick={() => {
                  setMemberSearch('');
                  go({
                    memberBatch: batch
                  });
                }}>{batch==='Unassigned'?t('Unassigned'):batch}<p>{members.filter(m => (formatBatchName(m.batch) || t("Unassigned")) === batch).length}{t("members")}</p></button>)}</div> : <><button className="btn-outline" onClick={back}>{t("Back to batches")}</button><h3>{route.memberBatch === 'Unassigned' ? t('Unassigned') : route.memberBatch}</h3><input aria-label={t("Search members")} placeholder={t("Search members")} value={memberSearch} onChange={e => setMemberSearch(e.target.value)} /></>}
                  {members.filter(m => route.memberBatch && (formatBatchName(m.batch) || t("Unassigned")) === route.memberBatch && (m.full_name || '').toLowerCase().includes(memberSearch.toLowerCase())).map(person => <div className="pending-row" key={person.id}>
                      <div>
                        <strong>{person.full_name}</strong>
                        <span>{t("Batch:")}{formatBatchName(person.batch) || t("Not specified")}{t("\xB7")}</span>
                        <small>{person.phone}</small>
                      </div>

                      <div className="pending-actions">
                        <button className="approve-btn" onClick={() => {
                    setEditingMember({
                      ...person,
                      batch: formatBatchName(person.batch)
                    });
                    go({
                      editMember: person.id
                    });
                  }}>
                          <Edit size={14} />{t("Edit")}</button>

                        {person.id !== session?.user?.id && <>{person.approval_status && <><button className="approve-btn" disabled={authLoading} onClick={() => reviewMember(person.id, "approved")}>{t("Approve")}</button><button className="reject-btn" disabled={authLoading} onClick={() => reviewMember(person.id, "rejected")}>{t("Reject")}</button></>}
                            <button className="reject-btn" onClick={() => manageAuthAccount(person.id, "ban")}>
                              <Ban size={14} />{t("Disable")}</button>

                            <button className="approve-btn" onClick={() => manageAuthAccount(person.id, "unban")}>
                              <RefreshCw size={14} />{t("Enable")}</button>

                            <button className="reject-btn" onClick={() => manageAuthAccount(person.id, "delete")}>
                              <Trash2 size={14} />{t("Delete Account")}</button>
                          </>}
                      </div>
                    </div>)}

                  {members.length === 0 && <p className="empty-state">{t("No member profiles found.")}</p>}
                </div>

                {/* EDIT MEMBER */}
                {editingMember && route.editMember === editingMember.id && <form className="content-card profile-form" onSubmit={adminUpdateMember} style={{
              marginTop: 24
            }}>
                    <h3>{t("Edit Member")}</h3>

                    <div className="form-grid">
                      <FormField label={t("Full Name")} value={editingMember.full_name} onChange={v => setEditingMember(old => ({
                  ...old,
                  full_name: v
                }))} required />

                      <FormField label={t("Address")} value={editingMember.address} onChange={v => setEditingMember(old => ({
                  ...old,
                  address: v
                }))} />

                      <div className="field">
                        <label>{t("Batch")}</label>
                        <BatchSelect batches={batches} value={editingMember.batch} includeInactive onChange={v => setEditingMember(old => ({
                    ...old,
                    batch: v
                  }))} required />
                      </div>

                      <FormField label={t("Phone")} value={editingMember.phone} onChange={v => setEditingMember(old => ({
                  ...old,
                  phone: v
                }))} />

                      <FormField label={t("Blood Group")} value={editingMember.blood_group} onChange={v => setEditingMember(old => ({
                  ...old,
                  blood_group: v
                }))} />

                      <div className="field full-field">
                        <label>{t("Short Bio")}</label>
                        <textarea value={editingMember.bio || ""} onChange={e => setEditingMember(old => ({
                    ...old,
                    bio: e.target.value
                  }))} />
                      </div>
                    </div>

                    <button className="btn-primary" disabled={authLoading}>
                      <Save size={17} />{t("Save Changes")}</button>

                    <button type="button" className="btn-outline" onClick={() => {
                setEditingMember(null);
                back();
              }}>{t("Cancel")}</button>
                  </form>}



                </div><div hidden={route.panel !== "events"} className="admin-section admin-events">{/* EVENT MANAGEMENT */}
                <div className="content-card" style={{
              marginTop: 24
            }}>
                  <h3>{t("Manage Events")}</h3>

                  <form onSubmit={saveEvent}><fieldset disabled={authLoading || eventUploading}><label className="checkbox-label"><input type="checkbox" checked={eventForm.enabled} onChange={e => setEventForm({
                    ...eventForm,
                    enabled: e.target.checked
                  })} />{t("Publicly visible")}</label><ImageUpload userId={session?.user.id} admin onBusy={setEventUploading} onUploaded={image_url => setEventForm(d => ({
                  ...d,
                  image_url
                }))} />{eventForm.image_url && <><img className="image-preview" src={eventForm.image_url} alt={t("Event preview")} /><button type="button" className="btn-outline" onClick={() => setEventForm(d => ({...d,image_url:""}))}>{t("Remove image")}</button></>}
                    <label>{t("Event Title")}</label>
                    <input required value={eventForm.title} onChange={e => setEventForm({
                  ...eventForm,
                  title: e.target.value
                })} />

                    <label>{t("Description")}</label>
                    <textarea value={eventForm.description} onChange={e => setEventForm({
                  ...eventForm,
                  description: e.target.value
                })} />

                    <label>{t("Date")}</label>
                    <input type="date" value={eventForm.event_date} onChange={e => setEventForm({
                  ...eventForm,
                  event_date: e.target.value
                })} />

                    <label>{t("Location")}</label>
                    <input value={eventForm.location} onChange={e => setEventForm({
                  ...eventForm,
                  location: e.target.value
                })} />

                    <button className="btn-primary" disabled={authLoading}>
                      <Plus size={16} />
                      {editingEvent ? t("Update Event") : t("Add Event")}
                    </button>

                    {editingEvent && <button type="button" className="btn-outline" onClick={() => {
                  setEditingEvent(null);
                  setEventForm(emptyEventForm);
                }}>{t("Cancel")}</button>}
                  </fieldset></form>

                  {events.map(event => <div className="pending-row" key={event.id}>
                      <div>
                        <strong>{event.title}</strong>
                        <span>{event.event_date || t("Date not set")}</span>
                      </div>

                      <div className="pending-actions">
                        <button className="approve-btn" onClick={() => {
                    setEditingEvent(event.id);
                    setEventForm({
                      title: event.title || "",
                      description: event.description || "",
                      event_date: event.event_date || "",
                      image_url: event.image_url || "",
                      enabled: event.enabled !== false,
                      location: event.location || ""
                    });
                  }}>{t("Edit")}</button>

                        <button className="reject-btn" onClick={() => deleteEvent(event.id)}>{t("Delete")}</button>
                      </div>
                    </div>)}
                </div>



                </div><div hidden={route.panel !== "committee"} className="admin-section admin-committee">{/* COMMITTEE MANAGEMENT */}
                <div className="content-card" style={{
              marginTop: 24
            }}>
                  <h3>{t("Manage Committee")}</h3>

                  <form onSubmit={saveCommittee}><fieldset disabled={authLoading || committeeUploading}><ImageUpload userId={session?.user.id} admin onBusy={setCommitteeUploading} onUploaded={photo_url => setCommitteeForm(d => ({
                  ...d,
                  photo_url
                }))} />
                    <label>{t("Committee year")}<input type="number" min="1900" max="2200" required value={committeeForm.committee_year} onChange={e => setCommitteeForm({
                    ...committeeForm,
                    committee_year: Number(e.target.value)
                  })} /></label>
                    <label className="checkbox-label"><input type="checkbox" checked={committeeForm.is_current} onChange={e => setCommitteeForm({
                    ...committeeForm,
                    is_current: e.target.checked
                  })} />{t("Current committee (uncheck for historical committee)")}</label>
                    <label>{t("Introduction")}<textarea value={committeeForm.introduction} onChange={e => setCommitteeForm({
                    ...committeeForm,
                    introduction: e.target.value
                  })} /></label>
                    <label>{t("Name")}</label>
                    <input required value={committeeForm.name} onChange={e => setCommitteeForm({
                  ...committeeForm,
                  name: e.target.value
                })} />

                    <label>{t("Position")}</label>
                    <input required value={committeeForm.position} onChange={e => setCommitteeForm({
                  ...committeeForm,
                  position: e.target.value
                })} />

                    <label>{t("Batch")}</label>
                    <input value={committeeForm.batch} onChange={e => setCommitteeForm({
                  ...committeeForm,
                  batch: e.target.value
                })} />

                    <label>{t("Photo URL")}</label>
                    <input value={committeeForm.photo_url} onChange={e => setCommitteeForm({
                  ...committeeForm,
                  photo_url: e.target.value
                })} />

                    <button className="btn-primary">
                      <Plus size={16} />
                      {editingCommittee ? t("Update") : t("Add Committee Member")}
                    </button>

                    {editingCommittee && <button type="button" className="btn-outline" onClick={() => {
                  setEditingCommittee(null);
                  setCommitteeForm(emptyCommitteeForm);
                }}>{t("Cancel")}</button>}
                  </fieldset></form>

                  {committee.map(person => <div className="pending-row" key={person.id}>
                      <div>
                        <strong>{person.name}</strong>
                        <span>{person.position}{t("\xB7") + " "}{person.is_current !== false ? t("Current") : t("Historical")}{t("\xB7") + " "}{person.committee_year || t("Year not set")}</span>
                      </div>

                      <div className="pending-actions">
                        <button className="approve-btn" onClick={() => {
                    setEditingCommittee(person.id);
                    setCommitteeForm({
                      name: person.name || "",
                      position: person.position || "",
                      batch: person.batch || "",
                      photo_url: person.photo_url || "",
                      introduction: person.introduction || "",
                      is_current: person.is_current !== false,
                      committee_year: person.committee_year || new Date().getFullYear(),
                    });
                  }}>{t("Edit")}</button>

                        <button className="reject-btn" onClick={() => deleteCommittee(person.id)}>{t("Delete")}</button>
                      </div>
                    </div>)}
                </div>

              </div></>}</Suspense>
          </section>}
      </main>

      {/* FOOTER */}
      <footer className="footer">
        <div className="container footer-content">
          <div>
            <h2>{t("SMSA")}</h2>
            <p>{t("Same Mind Student Association")}</p>
            <span>{t("Connecting generations, building friendships.")}</span>
          </div>

          <div className="footer-community"><h3>{t("Stay connected")}</h3><CommunityLinks items={content.items} /></div>
          <p>{t("\xA9") + " "}{new Date().getFullYear()}{" "}{t("SMSA. All rights reserved.")}</p>
        </div>
      </footer>
    </div>;
}
function Feature({
  icon,
  title,
  text
}) {
  return <div className="feature-card">
      <div className="feature-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>;
}
function PageHeading({
  label,
  title
}) {
  return <div className="page-heading">
      <span className="eyebrow">{label}</span>
      <h1>{title}</h1>
    </div>;
}
function FormField({
  label,
  value,
  onChange,
  type = "text",
  required = false
}) {
  const fieldId = useId();
  return <div className="field">
      <label htmlFor={fieldId}>{label}</label>
      <input id={fieldId} type={type} value={value ?? ""} required={required} onChange={e => onChange(e.target.value)} />
    </div>;
}

// BATCH SELECT FIELD
function BatchSelect({
  batches,
  value,
  onChange,
  includeInactive = false,
  required = false
}) {
  const {
    t
  } = useLanguage();
  const options = Array.from(new Map(batches.filter(batch => batch.is_active || includeInactive && formatBatchName(batch.name) === formatBatchName(value)).sort((a, b) => Number(b.is_active) - Number(a.is_active)).map(batch => [formatBatchName(batch.name), batch])).values());
  return <select value={formatBatchName(value) || ""} required={required} onChange={e => onChange(e.target.value)}>
        <option value="">{t("Select Batch")}</option>
        {options.map(batch => <option key={batch.id} value={formatBatchName(batch.name)}>
            {formatBatchName(batch.name)}{!batch.is_active ? t(" (Inactive)") : ""}
          </option>)}
      </select>;
}
