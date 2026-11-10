
import { useEffect, useState } from "react";
import {
  Menu, X, Users, GraduationCap, CalendarDays, ShieldCheck,
  LogIn, LogOut, UserCircle, ArrowRight, Heart,
  Search, Clock, MapPin, KeyRound, Trash2, Edit,
  Plus, Save, Ban, RefreshCw, ChevronLeft, Layers,
  Image, Upload, CheckCircle, XCircle
} from "lucide-react";
import { supabase } from "./lib/supabase";

const navItems = ["Home", "About", "Alumni", "Gallery", "Events", "Committee"];

const emptyForm = {
  full_name: "",
  address: "",
  passing_year: "",
  batch: "",
  phone: "",
  blood_group: "",
  bio: ""
};

const emptyEventForm = {
  title: "",
  description: "",
  event_date: "",
  location: ""
};

const emptyCommitteeForm = {
  name: "",
  position: "",
  batch: "",
  photo_url: "",
  display_order: 0
};

// BATCH NAME DISPLAY FORMAT
function formatBatchName(name) {
  if (!name) return "";

  const value = String(name).trim();

  const match = value.match(/^(?:batch|dakhil)[-\s]*(\d{2}|\d{4})$/i);

  if (match) {
    const year = match[1];
    return `Dakhil-${year.length === 2 ? `20${year}` : year}`;
  }

  return value;
}

export default function App() {
  const [page, setPage] = useState("Home");
  const [menuOpen, setMenuOpen] = useState(false);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [authMode, setAuthMode] = useState("choose");
  const [loginType, setLoginType] = useState("member");
  const [authLoading, setAuthLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [alumni, setAlumni] = useState([]);
  const [events, setEvents] = useState([]);
  const [committee, setCommittee] = useState([]);
  const [members, setMembers] = useState([]);

  // BATCH SYSTEM
  const [batches, setBatches] = useState([]);
  const [batchYear, setBatchYear] = useState("");
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [batchLoading, setBatchLoading] = useState(false);
  const [showBatchForm, setShowBatchForm] = useState(false);

  // BATCH GALLERY
  const [galleryBatch, setGalleryBatch] = useState(null);
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

  // AUTH INITIALIZATION
  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      setMessage("Supabase configuration is missing.");
      return;
    }

    let mounted = true;

    async function initialize() {
      const { data, error } = await supabase.auth.getSession();

      if (error) setMessage(error.message);

      if (mounted && data?.session) {
        setSession(data.session);
        await loadAccount(data.session.user);
      } else if (mounted) {
        setLoading(false);
      }

      if (mounted) {
        await Promise.all([
          loadPublicData(),
          loadBatches()
        ]);
      }
    }

    initialize();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        if (!mounted) return;

        if (event === "PASSWORD_RECOVERY") {
          setSession(newSession);
          setPage("ResetPassword");
          setLoading(false);
          return;
        }

        if (event === "SIGNED_IN" && newSession) {
          setSession(newSession);

          setTimeout(() => {
            if (mounted) loadAccount(newSession.user);
          }, 0);
        }

        if (event === "SIGNED_OUT") {
          setSession(null);
          setProfile(null);
          setIsAdmin(false);
          setMembers([]);
          setPendingGallery([]);
          setGalleryPhotos([]);
          setPage("Home");
          setLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  // PUBLIC DATA
  async function loadPublicData() {
    if (!supabase) return;

    const [a, e, c] = await Promise.all([
      supabase.from("public_alumni").select("*"),
      supabase.from("events").select("*").order("event_date"),
      supabase.from("committee_members").select("*").order("display_order")
    ]);

    if (a.error) {
      console.error("Alumni Loading Error:", a.error);
    } else {
      console.log("Public Alumni Data:", a.data);
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
      const { data, error } = await supabase
        .from("batches")
        .select("id, name, is_active, created_at")
        .order("name", { ascending: true });

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
    return Promise.all(
      (photos || []).map(async photo => {
        const { data, error } = await supabase.storage
          .from("batch-gallery")
          .createSignedUrl(photo.storage_path, 3600);

        return {
          ...photo,
          image_url: error ? null : data?.signedUrl || null
        };
      })
    );
  }

  // LOAD GALLERY PHOTOS
  async function loadGalleryPhotos(batchId) {
    if (!supabase || !batchId) return;

    setGalleryLoading(true);

    try {
      const { data, error } = await supabase
        .from("gallery_photos")
        .select("*")
        .eq("batch_id", batchId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const photos = await addGalleryImageUrls(data || []);
      setGalleryPhotos(photos);
    } catch (error) {
      setMessage("Gallery loading failed: " + error.message);
    } finally {
      setGalleryLoading(false);
    }
  }

  // LOAD PENDING PHOTOS FOR ADMIN
  async function loadPendingGallery(adminAccess = isAdmin) {
    if (!supabase || !adminAccess) return;

    try {
      const { data, error } = await supabase
        .from("gallery_photos")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const photos = await addGalleryImageUrls(data || []);
      setPendingGallery(photos);
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

    const ownBatch = batches.find(
      batch =>
        formatBatchName(batch.name) === formatBatchName(profile.batch) &&
        batch.is_active
    );

    if (!ownBatch || Number(ownBatch.id) !== Number(galleryBatch.id)) {
      setMessage("You can upload photos only to your own active batch.");
      return;
    }

    if (!galleryFile.type.startsWith("image/")) {
      setMessage("Only image files are allowed.");
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
      const { count, error: countError } = await supabase
        .from("gallery_photos")
        .select("id", { count: "exact", head: true })
        .eq("batch_id", galleryBatch.id)
        .eq("status", "approved");

      if (countError) throw countError;

      if ((count || 0) >= 100) {
        throw new Error("This batch has reached its 100 approved-photo limit.");
      }

      const safeFileName = galleryFile.name.replace(
        /[^a-zA-Z0-9._-]/g,
        "_"
      );

      storagePath =
        `${galleryBatch.id}/${session.user.id}/${crypto.randomUUID()}-${safeFileName}`;

      currentStage = "Uploading image to Supabase Storage";

      const { error: uploadError } = await supabase.storage
        .from("batch-gallery")
        .upload(storagePath, galleryFile, {
          contentType: galleryFile.type,
          upsert: false
        });

      if (uploadError) throw uploadError;

      currentStage = "Saving photo information to gallery_photos";

      const { error: insertError } = await supabase
        .from("gallery_photos")
        .insert({
          batch_id: galleryBatch.id,
          uploader_id: session.user.id,
          storage_path: storagePath,
          caption: galleryCaption.trim() || null,
          status: "pending"
        });

      if (insertError) {
        await supabase.storage
          .from("batch-gallery")
          .remove([storagePath]);

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
      setMessage(
        `Photo upload failed at [${currentStage}]: ${error.message}`
      );
    } finally {
      setGalleryUploading(false);
    }
  }

  // ADMIN APPROVE / REJECT PHOTO
  async function reviewGalleryPhoto(photoId, status) {
    if (!isAdmin || !session) return;

    try {
      const { error } = await supabase
        .from("gallery_photos")
        .update({
          status,
          reviewed_at: new Date().toISOString(),
          reviewed_by: session.user.id
        })
        .eq("id", photoId);

      if (error) throw error;

      setMessage(
        status === "approved"
          ? "Photo approved successfully."
          : "Photo rejected successfully."
      );

      await Promise.all([
        loadPendingGallery(true),
        galleryBatch
          ? loadGalleryPhotos(galleryBatch.id)
          : Promise.resolve()
      ]);
    } catch (error) {
      setMessage("Photo review failed: " + error.message);
    }
  }

  // ADMIN DELETE PHOTO
  async function deleteGalleryPhoto(photo) {
    if (!isAdmin) return;

    if (!window.confirm("Permanently delete this photo?")) return;

    try {
      const { error: storageError } = await supabase.storage
        .from("batch-gallery")
        .remove([photo.storage_path]);

      if (storageError) throw storageError;

      const { error } = await supabase
        .from("gallery_photos")
        .delete()
        .eq("id", photo.id);

      if (error) throw error;

      setMessage("Photo deleted successfully.");

      await Promise.all([
        loadPendingGallery(true),
        galleryBatch
          ? loadGalleryPhotos(galleryBatch.id)
          : Promise.resolve()
      ]);
    } catch (error) {
      setMessage("Photo deletion failed: " + error.message);
    }
  }

  // LOAD ACCOUNT
  async function loadAccount(user) {
    if (!supabase || !user) return;

    setLoading(true);

    try {
      const [p, r] = await Promise.all([
        supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle(),

        supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .maybeSingle()
      ]);

      if (p.error) throw p.error;
      if (r.error) throw r.error;

      const admin = r.data?.role === "admin";

      setIsAdmin(admin);
      setProfile(p.data || null);

      if (p.data) {
        setForm({
          ...emptyForm,
          ...p.data,
          passing_year: p.data.passing_year || ""
        });
      } else {
        setForm({
          ...emptyForm,
          full_name: user.user_metadata?.full_name || ""
        });
      }

      if (admin) {
        setPage("Admin");
        await Promise.all([
          loadAdminData(),
          loadBatches(),
          loadPendingGallery(true)
        ]);
      } else {
        setPage("Profile");
        setPendingGallery([]);
      }

      setMessage("");
    } catch (error) {
      setMessage("Account loading error: " + error.message);
    } finally {
      setLoading(false);
    }
  }

  // ADMIN DATA
  async function loadAdminData() {
    if (!supabase) return;

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setMessage("Could not load members: " + error.message);
      return;
    }

    setMembers(data || []);
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

    setPage(name);
    setMenuOpen(false);
    setMessage("");
    setSelectedBatch(null);
    setSearch("");
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
    setMenuOpen(false);
    setMessage("");
    setPassword("");
    setConfirmPassword("");
  }

  function openAdminLogin() {
    setLoginType("admin");
    setAuthMode("login");
    setPage("Login");
    setMenuOpen(false);
    setMessage("");
    setPassword("");
    setConfirmPassword("");
  }

  function openMemberLogin() {
    setLoginType("member");
    setAuthMode("login");
    setPage("Login");
    setMenuOpen(false);
    setMessage("");
    setPassword("");
    setConfirmPassword("");
  }

  function openMemberRegistration() {
    setLoginType("member");
    setAuthMode("signup");
    setPage("Login");
    setMenuOpen(false);
    setMessage("");
    setPassword("");
    setConfirmPassword("");
    loadBatches();
  }

  function updateForm(field, value) {
    setForm(old => ({ ...old, [field]: value }));
  }

  // MEMBER REGISTRATION
  async function registerMember(e) {
    e.preventDefault();
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

    if (!form.full_name.trim() || !form.passing_year || !form.batch) {
      setMessage("Full Name, Passing Year and Batch are required.");
      return;
    }

    const selected = batches.find(
      batch =>
        formatBatchName(batch.name) === formatBatchName(form.batch) &&
        batch.is_active
    );

    if (!selected) {
      setMessage("Please select an active Batch.");
      return;
    }

    setAuthLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
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
        setMessage(
          "Account created, but direct login is unavailable. Please check that Supabase Email Confirmation is OFF."
        );
        return;
      }

      const { error: profileError } = await supabase
        .from("profiles")
        .upsert({
          id: data.user.id,
          ...form,
          batch: formatBatchName(form.batch),
          full_name: form.full_name.trim(),
          address: form.address.trim() || null,
          passing_year: Number(form.passing_year),
          approval_status: "approved"
        });

      if (profileError) throw profileError;

      setPassword("");
      setConfirmPassword("");
      setSession(data.session);
      await loadAccount(data.user);
      setMessage("Member registration successful.");
    } catch (error) {
      setMessage("Registration error: " + error.message);
    } finally {
      setAuthLoading(false);
    }
  }

  // LOGIN
  async function login(e) {
    e.preventDefault();
    setMessage("");
    setAuthLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
      });

      if (error) throw error;

      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id)
        .maybeSingle();

      if (roleError) throw roleError;

      const userIsAdmin = roleData?.role === "admin";

      if (loginType === "admin" && !userIsAdmin) {
        await supabase.auth.signOut();
        setSession(null);
        setProfile(null);
        setIsAdmin(false);
        setPage("Login");
        setMessage(
          "Access denied. This account is not authorised as an Admin."
        );
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
      await loadAccount(data.user);

      setMessage(
        userIsAdmin
          ? "Admin login successful."
          : "Member login successful."
      );
    } catch (error) {
      setMessage("Login failed: " + error.message);
    } finally {
      setAuthLoading(false);
    }
  }

  // FORGOT PASSWORD
  async function sendPasswordReset(e) {
    e.preventDefault();
    setMessage("");
    setAuthLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo: window.location.origin }
      );

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
      const { error } = await supabase.auth.updateUser({ password });

      if (error) throw error;

      setPassword("");
      setConfirmPassword("");
      setMessage("Password updated successfully.");

      if (session) {
        await loadAccount(session.user);
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

    if (!form.full_name.trim() || !form.passing_year || !form.batch) {
      setMessage("Full Name, Passing Year and Batch are required.");
      return;
    }

    const currentBatch = profile?.batch;

    const selected = batches.find(
      batch =>
        formatBatchName(batch.name) === formatBatchName(form.batch) &&
        (batch.is_active ||
          formatBatchName(batch.name) === formatBatchName(currentBatch))
    );

    if (!selected) {
      setMessage("Please select an active Batch.");
      return;
    }

    setAuthLoading(true);

    try {
      const { data, error } = await supabase
        .from("profiles")
        .upsert({
          id: session.user.id,
          ...form,
          batch: formatBatchName(form.batch),
          full_name: form.full_name.trim(),
          address: form.address.trim() || null,
          passing_year: Number(form.passing_year),
          approval_status: profile?.approval_status || "approved"
        })
        .select()
        .single();

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

    if (batches.some(
      batch => formatBatchName(batch.name).toLowerCase() === batchName.toLowerCase()
    )) {
      setMessage(`${batchName} already exists.`);
      return;
    }

    setAuthLoading(true);

    try {
      const { error } = await supabase
        .from("batches")
        .insert({
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

    const confirmText = nextStatus
      ? `Activate ${formatBatchName(batch.name)}?`
      : `Deactivate ${formatBatchName(batch.name)}? New members will no longer be able to select it.`;

    if (!window.confirm(confirmText)) return;

    try {
      const { error } = await supabase
        .from("batches")
        .update({ is_active: nextStatus })
        .eq("id", batch.id);

      if (error) throw error;

      setMessage(
        `${formatBatchName(batch.name)} ${nextStatus ? "activated" : "deactivated"} successfully.`
      );

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

    setAuthLoading(true);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: editingMember.full_name,
          address: editingMember.address || null,
          passing_year: Number(editingMember.passing_year),
          batch: formatBatchName(editingMember.batch),
          phone: editingMember.phone,
          blood_group: editingMember.blood_group,
          bio: editingMember.bio
        })
        .eq("id", editingMember.id);

      if (error) throw error;

      setEditingMember(null);
      setMessage("Member profile updated.");
      await loadAdminData();
      await loadPublicData();
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

    if (!window.confirm(
      "Delete this member's profile data? This does not delete the Auth account."
    )) return;

    const { error } = await supabase
      .from("profiles")
      .delete()
      .eq("id", userId);

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

    const confirmText = action === "delete"
      ? "Permanently delete this account? This action cannot be undone."
      : action === "ban"
        ? "Disable this member's login?"
        : "Re-enable this member's login?";

    if (!window.confirm(confirmText)) return;

    try {
      const { data, error } = await supabase.functions.invoke(
        "admin-manage-user",
        { body: { user_id: userId, action } }
      );

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setMessage(data?.message || "Account action completed.");
      await loadAdminData();
    } catch (error) {
      setMessage(
        "Account action failed: " + error.message +
        ". Make sure the admin-manage-user Edge Function is deployed."
      );
    }
  }

  // ADMIN: EVENTS
  async function saveEvent(e) {
    e.preventDefault();
    if (!isAdmin) return;

    try {
      const eventData = {
        ...eventForm,
        event_date: eventForm.event_date || null
      };

      const query = editingEvent
        ? supabase.from("events").update(eventData).eq("id", editingEvent)
        : supabase.from("events").insert(eventData);

      const { error } = await query;
      if (error) throw error;

      setEventForm(emptyEventForm);
      setEditingEvent(null);
      setMessage("Event saved.");
      await loadPublicData();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function deleteEvent(id) {
    if (!isAdmin || !window.confirm("Delete this event?")) return;

    const { error } = await supabase
      .from("events")
      .delete()
      .eq("id", id);

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
    if (!isAdmin) return;

    try {
      const query = editingCommittee
        ? supabase
          .from("committee_members")
          .update(committeeForm)
          .eq("id", editingCommittee)
        : supabase
          .from("committee_members")
          .insert(committeeForm);

      const { error } = await query;
      if (error) throw error;

      setCommitteeForm(emptyCommitteeForm);
      setEditingCommittee(null);
      setMessage("Committee member saved.");
      await loadPublicData();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function deleteCommittee(id) {
    if (!isAdmin || !window.confirm("Delete this committee member?")) return;

    const { error } = await supabase
      .from("committee_members")
      .delete()
      .eq("id", id);

    if (error) {
      setMessage(error.message);
    } else {
      setMessage("Committee member deleted.");
      await loadPublicData();
    }
  }

  // LOGOUT
  async function logout() {
    const { error } = await supabase.auth.signOut();

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

  const generatedBatchNames = Array.from(
    { length: Math.max(0, currentYear - 2005) },
    (_, index) => `Dakhil-${2006 + index}`
  );

  const alumniBatchNames = alumni
    .map(person => formatBatchName(person.batch))
    .filter(Boolean);

  const displayedBatchNames = [
    ...new Set([
      ...generatedBatchNames,
      ...batches.map(batch => formatBatchName(batch.name)),
      ...alumniBatchNames
    ])
  ].sort((a, b) => {
    const yearA = Number(a.match(/\d{4}$/)?.[0] || 0);
    const yearB = Number(b.match(/\d{4}$/)?.[0] || 0);
    return yearA - yearB;
  });

  const filteredBatchNames = displayedBatchNames.filter(name =>
    name.toLowerCase().includes(search.toLowerCase())
  );

  const filteredAlumni = alumni.filter(person =>
    `${person.full_name || ""} ${formatBatchName(person.batch)} ${person.passing_year || ""}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const selectedBatchAlumni = filteredAlumni.filter(
    person => formatBatchName(person.batch) === formatBatchName(selectedBatch)
  );

  // BATCH SELECT FIELD
  function BatchSelect({
    value,
    onChange,
    includeInactive = false,
    required = false
  }) {
    const options = Array.from(
      new Map(
        batches
          .filter(batch =>
            batch.is_active ||
            (includeInactive &&
              formatBatchName(batch.name) === formatBatchName(value))
          )
          .sort((a, b) => Number(b.is_active) - Number(a.is_active))
          .map(batch => [formatBatchName(batch.name), batch])
      ).values()
    );

    return (
      <select
        value={formatBatchName(value) || ""}
        required={required}
        onChange={e => onChange(e.target.value)}
      >
        <option value="">Select Batch</option>
        {options.map(batch => (
          <option
            key={batch.id}
            value={formatBatchName(batch.name)}
          >
            {formatBatchName(batch.name)}{!batch.is_active ? " (Inactive)" : ""}
          </option>
        ))}
      </select>
    );
  }

  return (
    <div className="app">
      <header className="navbar">
        <div className="nav-container">
          <button className="brand" onClick={() => navigate("Home")}>
            <span className="brand-icon">
              <GraduationCap size={27} />
            </span>
            <span>
              <strong>SMSA</strong>
              <small>Same Mind Student Association</small>
            </span>
          </button>

          <button
            className="mobile-menu"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X /> : <Menu />}
          </button>

          <nav className={menuOpen ? "nav-links open" : "nav-links"}>
            {navItems.map(item => (
              <button
                key={item}
                className={page === item ? "nav-link active" : "nav-link"}
                onClick={() => navigate(item)}
              >
                {item}
              </button>
            ))}

            {session ? (
              <>
                {!isAdmin && (
                  <button
                    className="nav-link"
                    onClick={() => navigate("Profile")}
                  >
                    <UserCircle size={16} /> My Profile
                  </button>
                )}

                {isAdmin && (
                  <button
                    className="nav-link"
                    onClick={() => navigate("Admin")}
                  >
                    <ShieldCheck size={16} /> Admin Dashboard
                  </button>
                )}

                <button className="nav-login" onClick={logout}>
                  <LogOut size={16} /> Logout
                </button>
              </>
            ) : (
              <button className="nav-login" onClick={openLoginOptions}>
                <LogIn size={16} /> Login
              </button>
            )}
          </nav>
        </div>
      </header>

      <main>
        {message && (
          <div className="message container">
            {message}
            <button onClick={() => setMessage("")}>
              <X size={16} />
            </button>
          </div>
        )}

        {/* HOME */}
        {page === "Home" && (
          <>
            <section className="hero">
              <div className="hero-content">
                <span className="eyebrow">
                  WELCOME TO OUR ALUMNI COMMUNITY
                </span>

                <h1>
                  Once a Student,<br />
                  <span>Always a Family.</span>
                </h1>

                <p>
                  Connecting the past, celebrating the present, and building
                  the future of our beloved institution.
                </p>

                <div className="hero-actions">
                  <button
                    className="btn-primary"
                    onClick={openMemberRegistration}
                  >
                    Join Our Community <ArrowRight size={18} />
                  </button>

                  <button
                    className="btn-outline"
                    onClick={() => navigate("Alumni")}
                  >
                    Explore Alumni
                  </button>
                </div>
              </div>

              <div className="hero-art">
                <div className="hero-circle">
                  <GraduationCap size={105} strokeWidth={1.2} />
                  <span>SMSA</span>
                </div>
              </div>
            </section>

            <section className="stats container">
              <div className="stat-card">
                <Users size={27} />
                <strong>{alumni.length}+</strong>
                <span>Registered Alumni</span>
              </div>

              <div className="stat-card">
                <CalendarDays size={27} />
                <strong>{events.length}+</strong>
                <span>Community Events</span>
              </div>

              <div className="stat-card">
                <Heart size={27} />
                <strong>One</strong>
                <span>United Community</span>
              </div>
            </section>

            <section className="section container">
              <div className="section-heading">
                <span className="eyebrow">OUR COMMUNITY</span>
                <h2>More Than Just Alumni</h2>
                <p>
                  Stay connected with friends, classmates, and your institution.
                </p>
              </div>

              <div className="feature-grid">
                <Feature
                  icon={<Users />}
                  title="Alumni Network"
                  text="Reconnect with your classmates and discover fellow alumni."
                />

                <Feature
                  icon={<CalendarDays />}
                  title="Events & Reunion"
                  text="Stay updated about reunions, programs, and community events."
                />

                <Feature
                  icon={<Heart />}
                  title="Stronger Together"
                  text="Build meaningful connections and support one another."
                />
              </div>
            </section>
          </>
        )}

        {/* ABOUT */}
        {page === "About" && (
          <section className="page-section container">
            <PageHeading label="ABOUT SMSA" title="Our Story" />

            <div className="content-card">
              <h3>Same Mind Student Association</h3>
              <p>
                SMSA is an alumni community for former students of Sakhipur
                Thana Sadar Dakhil Madrasah. Our purpose is to maintain
                lifelong connections, bring former classmates together, and
                create opportunities to support one another.
              </p>
              <p>
                No matter when we graduated or where life has taken us,
                we share a common history and a lasting connection.
              </p>
            </div>
          </section>
        )}

        {/* ALUMNI */}
        {page === "Alumni" && (
          <section className="page-section container">
            <PageHeading
              label="OUR NETWORK"
              title={selectedBatch ? formatBatchName(selectedBatch) : "Meet Our Alumni"}
            />

            {!selectedBatch && (
              <>
                <div className="alumni-top-actions">
                  <div className="search-box">
                    <Search size={19} />
                    <input
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Search by batch name..."
                    />
                  </div>

                  {isAdmin && (
                    <button
                      type="button"
                      className="btn-primary add-batch-button"
                      onClick={() => setShowBatchForm(!showBatchForm)}
                    >
                      <Plus size={18} />
                      Add a New Batch
                    </button>
                  )}
                </div>

                {isAdmin && showBatchForm && (
                  <div className="content-card add-batch-panel">
                    <h3>
                      <Layers size={20} /> Add a New Batch
                    </h3>

                    <p>
                      Enter the last two digits of the year. Example: 27
                      will create Dakhil-2027.
                    </p>

                    <form onSubmit={createBatch}>
                      <label>Batch Year (06–99)</label>
                      <input
                        type="number"
                        min="6"
                        max="99"
                        required
                        placeholder="Example: 27"
                        value={batchYear}
                        onChange={e => setBatchYear(e.target.value)}
                      />

                      <div className="hero-actions">
                        <button
                          className="btn-primary"
                          disabled={authLoading}
                        >
                          <Plus size={17} />
                          {authLoading ? "Creating..." : "Create Batch"}
                        </button>

                        <button
                          type="button"
                          className="btn-outline"
                          onClick={() => {
                            setShowBatchForm(false);
                            setBatchYear("");
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </>
            )}

            {selectedBatch ? (
              <>
                <button
                  type="button"
                  className="btn-outline"
                  style={{ marginBottom: 24 }}
                  onClick={() => {
                    setSelectedBatch(null);
                    setSearch("");
                  }}
                >
                  <ChevronLeft size={17} /> Back to All Batches
                </button>

                <div className="search-box">
                  <Search size={19} />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search alumni by name or passing year..."
                  />
                </div>

                <div className="alumni-grid">
                  {selectedBatchAlumni.map(person => (
                    <div className="alumni-card" key={person.id}>
                      <div className="avatar">
                        {person.photo_url
                          ? <img src={person.photo_url} alt={person.full_name} />
                          : <UserCircle size={48} />}
                      </div>

                      <h3>{person.full_name}</h3>
                      <p>Batch: {formatBatchName(person.batch) || "Not specified"}</p>
                      <span>
                        Passing Year: {person.passing_year || "N/A"}
                      </span>
                    </div>
                  ))}

                  {selectedBatchAlumni.length === 0 && (
                    <p className="empty-state">
                      No alumni found in {formatBatchName(selectedBatch)}.
                    </p>
                  )}
                </div>
              </>
            ) : (
              <div className="batch-grid">
                {batchLoading ? (
                  <p className="empty-state">Loading batches...</p>
                ) : (
                  filteredBatchNames.map(batchName => {
                    const count = alumni.filter(
                      person =>
                        formatBatchName(person.batch) === formatBatchName(batchName)
                    ).length;

                    return (
                      <button
                        type="button"
                        className="batch-card"
                        key={batchName}
                        onClick={() => {
                          setSelectedBatch(batchName);
                          setSearch("");
                        }}
                      >
                        <div className="batch-card-icon">
                          <GraduationCap size={30} />
                        </div>

                        <h3>{formatBatchName(batchName)}</h3>
                        <p>
                          {count} {count === 1 ? "Alumnus" : "Alumni"}
                        </p>

                        <span>
                          Explore Batch <ArrowRight size={16} />
                        </span>
                      </button>
                    );
                  })
                )}

                {!batchLoading && filteredBatchNames.length === 0 && (
                  <p className="empty-state">No batches found.</p>
                )}
              </div>
            )}
          </section>
        )}

        {/* BATCH GALLERY */}
        {page === "Gallery" && (
          <section className="page-section container">
            <PageHeading
              label="MEMORIES TOGETHER"
              title={galleryBatch
                ? `${formatBatchName(galleryBatch.name)} Gallery`
                : "Batch Gallery"}
            />

            {!galleryBatch ? (
              <>
                <p className="gallery-intro">
                  Explore memories shared by our alumni, batch by batch.
                </p>

                {batchLoading ? (
                  <p className="empty-state">Loading batches...</p>
                ) : (
                  <div className="batch-grid">
                    {batches
                      .filter(batch => batch.is_active)
                      .map(batch => (
                        <button
                          type="button"
                          className="batch-card"
                          key={batch.id}
                          onClick={() => {
                            setGalleryBatch(batch);
                            setGalleryPhotos([]);
                            loadGalleryPhotos(batch.id);
                          }}
                        >
                          <div className="batch-card-icon">
                            <Image size={30} />
                          </div>

                          <h3>{formatBatchName(batch.name)}</h3>
                          <p>Batch memories</p>

                          <span>
                            Open Gallery <ArrowRight size={16} />
                          </span>
                        </button>
                      ))}

                    {batches.filter(batch => batch.is_active).length === 0 && (
                      <p className="empty-state">No active batches found.</p>
                    )}
                  </div>
                )}
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="btn-outline"
                  style={{ marginBottom: 24 }}
                  onClick={() => {
                    setGalleryBatch(null);
                    setGalleryPhotos([]);
                    setGalleryFile(null);
                    setGalleryCaption("");
                  }}
                >
                  <ChevronLeft size={17} /> Back to All Batches
                </button>

                {session &&
                  profile &&
                  formatBatchName(profile.batch) === formatBatchName(galleryBatch.name) &&
                  galleryBatch.is_active && (
                    <div className="content-card gallery-upload-panel">
                      <h3>
                        <Upload size={21} /> Upload a Photo
                      </h3>

                      <p>
                        Upload a memory from your batch. Your photo will appear
                        in the public gallery after Admin approval.
                      </p>

                      <form onSubmit={uploadGalleryPhoto}>
                        <label>Select Photo</label>
                        <input
                          id="gallery-file-input"
                          type="file"
                          accept="image/*"
                          required
                          onChange={e =>
                            setGalleryFile(e.target.files?.[0] || null)
                          }
                        />

                        <label>Caption (Optional)</label>
                        <input
                          type="text"
                          value={galleryCaption}
                          maxLength={200}
                          placeholder="Write a caption for your photo..."
                          onChange={e => setGalleryCaption(e.target.value)}
                        />

                        <button
                          className="btn-primary"
                          disabled={galleryUploading || !galleryFile}
                        >
                          <Upload size={17} />
                          {galleryUploading ? "Uploading..." : "Submit Photo"}
                        </button>
                      </form>
                    </div>
                  )}

                {!session && (
                  <div className="content-card gallery-login-notice">
                    <p>Login to upload photos from your own batch.</p>
                    <button className="btn-primary" onClick={openLoginOptions}>
                      <LogIn size={17} /> Login
                    </button>
                  </div>
                )}

                {session &&
                  profile &&
                  formatBatchName(profile.batch) !== formatBatchName(galleryBatch.name) && (
                    <div className="content-card gallery-login-notice">
                      <p>
                        You can upload photos only to your own batch:
                        {" "}{formatBatchName(profile.batch)}.
                      </p>
                    </div>
                  )}

                <div className="gallery-grid">
                  {galleryLoading ? (
                    <p className="empty-state">Loading photos...</p>
                  ) : (
                    galleryPhotos
                      .filter(photo =>
                        photo.status === "approved" ||
                        photo.uploader_id === session?.user?.id ||
                        isAdmin
                      )
                      .map(photo => (
                        <article className="gallery-card" key={photo.id}>
                          {photo.image_url ? (
                            <img
                              className="gallery-image"
                              src={photo.image_url}
                              alt={photo.caption || "Batch memory"}
                            />
                          ) : (
                            <div className="gallery-image gallery-image-empty">
                              <Image size={35} />
                              <span>Image unavailable</span>
                            </div>
                          )}

                          <div className="gallery-card-content">
                            {photo.caption && <p>{photo.caption}</p>}

                            {photo.status !== "approved" && (
                              <span className={`gallery-status ${photo.status}`}>
                                {photo.status === "pending"
                                  ? "Waiting for approval"
                                  : "Rejected"}
                              </span>
                            )}

                            {isAdmin && (
                              <div className="gallery-admin-actions">
                                {photo.status === "pending" && (
                                  <>
                                    <button
                                      type="button"
                                      className="approve-btn"
                                      onClick={() =>
                                        reviewGalleryPhoto(photo.id, "approved")
                                      }
                                    >
                                      <CheckCircle size={14} /> Approve
                                    </button>

                                    <button
                                      type="button"
                                      className="reject-btn"
                                      onClick={() =>
                                        reviewGalleryPhoto(photo.id, "rejected")
                                      }
                                    >
                                      <XCircle size={14} /> Reject
                                    </button>
                                  </>
                                )}

                                <button
                                  type="button"
                                  className="reject-btn"
                                  onClick={() => deleteGalleryPhoto(photo)}
                                >
                                  <Trash2 size={14} /> Delete
                                </button>
                              </div>
                            )}
                          </div>
                        </article>
                      ))
                  )}

                  {!galleryLoading &&
                    galleryPhotos.filter(photo =>
                      photo.status === "approved" ||
                      photo.uploader_id === session?.user?.id ||
                      isAdmin
                    ).length === 0 && (
                      <p className="empty-state">
                        No approved photos in this batch yet.
                      </p>
                    )}
                </div>
              </>
            )}
          </section>
        )}

        {/* EVENTS */}
        {page === "Events" && (
          <section className="page-section container">
            <PageHeading
              label="STAY CONNECTED"
              title="Events & Announcements"
            />

            <div className="event-grid">
              {events.map(event => (
                <article className="event-card" key={event.id}>
                  <div className="event-icon">
                    <CalendarDays size={28} />
                  </div>

                  <h3>{event.title}</h3>
                  <p>{event.description}</p>

                  {event.event_date && (
                    <span>
                      <Clock size={15} /> {event.event_date}
                    </span>
                  )}

                  {event.location && (
                    <span>
                      <MapPin size={15} /> {event.location}
                    </span>
                  )}
                </article>
              ))}

              {events.length === 0 && (
                <p className="empty-state">
                  No events have been published yet.
                </p>
              )}
            </div>
          </section>
        )}

        {/* COMMITTEE */}
        {page === "Committee" && (
          <section className="page-section container">
            <PageHeading
              label="LEADERSHIP"
              title="Our Executive Committee"
            />

            <div className="committee-grid">
              {committee.map(member => (
                <div className="committee-card" key={member.id}>
                  <div className="avatar">
                    {member.photo_url
                      ? <img src={member.photo_url} alt={member.name} />
                      : <UserCircle size={48} />}
                  </div>

                  <h3>{member.name}</h3>
                  <strong>{member.position}</strong>
                  <span>{member.batch || ""}</span>
                </div>
              ))}

              {committee.length === 0 && (
                <p className="empty-state">
                  Committee information will be published here.
                </p>
              )}
            </div>
          </section>
        )}

        {/* LOGIN AND REGISTRATION */}
        {page === "Login" && (
          <section className="auth-section">
            <div className="auth-card">
              <div className="auth-icon">
                {authMode === "choose" ? (
                  <LogIn size={30} />
                ) : loginType === "admin" ? (
                  <ShieldCheck size={30} />
                ) : (
                  <GraduationCap size={30} />
                )}
              </div>

              <span className="eyebrow">
                {authMode === "choose"
                  ? "WELCOME TO SMSA"
                  : loginType === "admin"
                    ? "SMSA ADMINISTRATION"
                    : "SMSA MEMBER ACCOUNT"}
              </span>

              {authMode === "choose" && (
                <>
                  <h2>Welcome Back</h2>
                  <p>Please select your account type to continue.</p>

                  <div className="login-options">
                    <button
                      type="button"
                      className="login-option"
                      onClick={openMemberLogin}
                    >
                      <Users size={27} />
                      <span>
                        <strong>Member Login</strong>
                        <small>Login to your member account</small>
                      </span>
                      <ArrowRight size={19} />
                    </button>

                    <button
                      type="button"
                      className="login-option"
                      onClick={openAdminLogin}
                    >
                      <ShieldCheck size={27} />
                      <span>
                        <strong>Admin Login</strong>
                        <small>Login to the Admin Dashboard</small>
                      </span>
                      <ArrowRight size={19} />
                    </button>
                  </div>

                  <p className="auth-switch">
                    Don't have an account?{" "}
                    <button onClick={openMemberRegistration}>
                      Register Now
                    </button>
                  </p>
                </>
              )}

              {authMode === "login" && (
                <>
                  <h2>
                    {loginType === "admin" ? "Admin Login" : "Member Login"}
                  </h2>

                  <p>
                    {loginType === "admin"
                      ? "Login using your authorised Admin account."
                      : "Login using your registered email and password."}
                  </p>

                  <form onSubmit={login}>
                    <label>Email Address</label>
                    <input
                      type="email"
                      required
                      value={email}
                      placeholder="you@example.com"
                      onChange={e => setEmail(e.target.value)}
                    />

                    <label>Password</label>
                    <input
                      type="password"
                      required
                      value={password}
                      placeholder="Enter your password"
                      onChange={e => setPassword(e.target.value)}
                    />

                    <button
                      className="btn-primary full-width"
                      disabled={authLoading}
                    >
                      {authLoading ? "Please wait..." : "Login"}
                      <ArrowRight size={17} />
                    </button>
                  </form>

                  <button
                    className="text-button"
                    onClick={() => {
                      setAuthMode("forgot");
                      setMessage("");
                    }}
                  >
                    Forgot Password?
                  </button>

                  {loginType === "member" && (
                    <p className="auth-switch">
                      Don't have an account?{" "}
                      <button onClick={openMemberRegistration}>
                        Register Now
                      </button>
                    </p>
                  )}

                  <div className="auth-note">
                    <ShieldCheck size={16} />
                    {loginType === "admin"
                      ? "Restricted to authorised Admin accounts only."
                      : "Member accounts cannot access the Admin Dashboard."}
                  </div>

                  <button
                    type="button"
                    className="text-button"
                    onClick={openLoginOptions}
                  >
                    Back to Login Options
                  </button>
                </>
              )}

              {authMode === "signup" && loginType === "member" && (
                <>
                  <h2>Create Member Account</h2>
                  <p>Fill in your information to join SMSA.</p>

                  <form onSubmit={registerMember}>
                    <label>Full Name</label>
                    <input
                      required
                      value={form.full_name}
                      onChange={e => updateForm("full_name", e.target.value)}
                    />

                    <label>Address (Optional)</label>
                    <input
                      value={form.address}
                      onChange={e => updateForm("address", e.target.value)}
                      placeholder="Your address"
                    />

                    <label>Passing Year</label>
                    <input
                      type="number"
                      required
                      value={form.passing_year}
                      onChange={e => updateForm("passing_year", e.target.value)}
                    />

                    <label>Batch</label>
                    <BatchSelect
                      value={form.batch}
                      onChange={value => updateForm("batch", value)}
                      required
                    />

                    <label>Phone Number</label>
                    <input
                      value={form.phone}
                      onChange={e => updateForm("phone", e.target.value)}
                    />

                    <label>Blood Group</label>
                    <select
                      value={form.blood_group}
                      onChange={e => updateForm("blood_group", e.target.value)}
                    >
                      <option value="">Select blood group</option>
                      {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map(g => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>

                    <label>Short Bio</label>
                    <textarea
                      value={form.bio}
                      onChange={e => updateForm("bio", e.target.value)}
                      placeholder="Tell us about yourself..."
                    />

                    <label>Email Address</label>
                    <input
                      type="email"
                      required
                      value={email}
                      placeholder="you@example.com"
                      onChange={e => setEmail(e.target.value)}
                    />

                    <label>Password</label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={password}
                      placeholder="At least 6 characters"
                      onChange={e => setPassword(e.target.value)}
                    />

                    <label>Confirm Password</label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={confirmPassword}
                      placeholder="Enter password again"
                      onChange={e => setConfirmPassword(e.target.value)}
                    />

                    <button
                      className="btn-primary full-width"
                      disabled={authLoading || batchLoading}
                    >
                      {authLoading ? "Creating account..." : "Register"}
                      <ArrowRight size={17} />
                    </button>
                  </form>

                  <p className="auth-switch">
                    Already registered?{" "}
                    <button
                      onClick={() => {
                        setLoginType("member");
                        setAuthMode("login");
                        setMessage("");
                      }}
                    >
                      Login
                    </button>
                  </p>
                </>
              )}

              {authMode === "forgot" && (
                <>
                  <h2>Forgot Password?</h2>
                  <p>Enter your email to receive a password reset link.</p>

                  <form onSubmit={sendPasswordReset}>
                    <label>Email Address</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                    />

                    <button
                      className="btn-primary full-width"
                      disabled={authLoading}
                    >
                      {authLoading ? "Sending..." : "Send Reset Link"}
                    </button>
                  </form>

                  <button
                    className="text-button"
                    onClick={() => {
                      setAuthMode("login");
                      setMessage("");
                    }}
                  >
                    Back to {loginType === "admin" ? "Admin" : "Member"} Login
                  </button>
                </>
              )}
            </div>
          </section>
        )}

        {/* RESET PASSWORD */}
        {page === "ResetPassword" && (
          <section className="auth-section">
            <div className="auth-card">
              <div className="auth-icon">
                <KeyRound size={30} />
              </div>

              <h2>Create New Password</h2>

              <form onSubmit={updatePassword}>
                <label>New Password</label>
                <input
                  type="password"
                  minLength={6}
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />

                <label>Confirm New Password</label>
                <input
                  type="password"
                  minLength={6}
                  required
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                />

                <button
                  className="btn-primary full-width"
                  disabled={authLoading}
                >
                  Update Password
                </button>
              </form>
            </div>
          </section>
        )}

        {/* MEMBER PROFILE */}
        {page === "Profile" && (
          <section className="page-section container">
            <PageHeading label="MEMBER ACCOUNT" title="My Profile" />

            {loading ? (
              <p>Loading account...</p>
            ) : (
              <form
                className="profile-form content-card"
                onSubmit={saveProfile}
              >
                <h3>Personal Information</h3>

                <div className="form-grid">
                  <FormField
                    label="Full Name"
                    value={form.full_name}
                    onChange={v => updateForm("full_name", v)}
                    required
                  />

                  <FormField
                    label="Address (Optional)"
                    value={form.address}
                    onChange={v => updateForm("address", v)}
                  />

                  <FormField
                    label="Passing Year"
                    type="number"
                    value={form.passing_year}
                    onChange={v => updateForm("passing_year", v)}
                    required
                  />

                  <div className="field">
                    <label>Batch</label>
                    <BatchSelect
                      value={form.batch}
                      onChange={value => updateForm("batch", value)}
                      includeInactive
                      required
                    />
                  </div>

                  <FormField
                    label="Phone Number"
                    value={form.phone}
                    onChange={v => updateForm("phone", v)}
                  />

                  <div className="field">
                    <label>Blood Group</label>
                    <select
                      value={form.blood_group}
                      onChange={e => updateForm("blood_group", e.target.value)}
                    >
                      <option value="">Select blood group</option>
                      {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map(g => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>

                  <div className="field full-field">
                    <label>Short Bio</label>
                    <textarea
                      value={form.bio}
                      onChange={e => updateForm("bio", e.target.value)}
                    />
                  </div>
                </div>

                <button className="btn-primary" disabled={authLoading}>
                  <Save size={17} /> Save Profile
                </button>
              </form>
            )}
          </section>
        )}

        {/* ADMIN DASHBOARD */}
        {page === "Admin" && (
          <section className="page-section container">
            <PageHeading label="ADMINISTRATION" title="Admin Dashboard" />

            {!isAdmin ? (
              <div className="content-card">
                <ShieldCheck size={35} />
                <h3>Admin access required</h3>
              </div>
            ) : (
              <>
                {/* BATCH MANAGEMENT */}
                <div className="content-card">
                  <h3>
                    <Layers size={21} style={{ verticalAlign: "middle" }} />{" "}
                    Batch Management ({batches.length})
                  </h3>

                  <p>
                    Enter the last two digits of the year to create a batch.
                    Example: 27 creates Dakhil-2027.
                  </p>

                  <form onSubmit={createBatch}>
                    <label>New Batch Year (06–99)</label>
                    <input
                      type="number"
                      min="6"
                      max="99"
                      required
                      placeholder="Example: 27"
                      value={batchYear}
                      onChange={e => setBatchYear(e.target.value)}
                    />

                    <button
                      className="btn-primary"
                      disabled={authLoading}
                    >
                      <Plus size={17} />
                      {authLoading ? "Creating..." : "Create Batch"}
                    </button>
                  </form>

                  <div style={{ marginTop: 24 }}>
                    <h3>All Batches</h3>

                    {batchLoading ? (
                      <p>Loading batches...</p>
                    ) : batches.length === 0 ? (
                      <p className="empty-state">No batches found.</p>
                    ) : (
                      Array.from(
                        new Map(
                          batches.map(batch => [
                            formatBatchName(batch.name),
                            batch
                          ])
                        ).values()
                      ).map(batch => (
                        <div className="pending-row" key={batch.id}>
                          <div>
                            <strong>{formatBatchName(batch.name)}</strong>
                            <span>
                              {batch.is_active ? "Active" : "Inactive"}
                            </span>
                          </div>

                          <div className="pending-actions">
                            <button
                              type="button"
                              className={
                                batch.is_active ? "reject-btn" : "approve-btn"
                              }
                              onClick={() => toggleBatch(batch)}
                            >
                              {batch.is_active ? (
                                <>
                                  <Ban size={14} /> Deactivate
                                </>
                              ) : (
                                <>
                                  <RefreshCw size={14} /> Activate
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* GALLERY APPROVAL */}
                <div className="content-card" style={{ marginTop: 24 }}>
                  <h3>
                    <Image size={21} style={{ verticalAlign: "middle" }} />{" "}
                    Gallery Photo Approval ({pendingGallery.length})
                  </h3>

                  <p>
                    Review submitted photos. Approved photos will be visible
                    to everyone in the Gallery.
                  </p>

                  <button
                    type="button"
                    className="btn-outline"
                    onClick={() => loadPendingGallery(true)}
                    style={{ marginBottom: 20 }}
                  >
                    <RefreshCw size={16} /> Refresh Pending Photos
                  </button>

                  {pendingGallery.length === 0 ? (
                    <p className="empty-state">No pending photos.</p>
                  ) : (
                    <div className="gallery-grid">
                      {pendingGallery.map(photo => {
                        const uploader = members.find(
                          member => member.id === photo.uploader_id
                        );

                        const photoBatch = batches.find(
                          batch => Number(batch.id) === Number(photo.batch_id)
                        );

                        return (
                          <article className="gallery-card" key={photo.id}>
                            {photo.image_url ? (
                              <img
                                className="gallery-image"
                                src={photo.image_url}
                                alt={photo.caption || "Pending photo"}
                              />
                            ) : (
                              <div className="gallery-image gallery-image-empty">
                                <Image size={35} />
                                <span>Image unavailable</span>
                              </div>
                            )}

                            <div className="gallery-card-content">
                              <strong>
                                {uploader?.full_name || "Unknown member"}
                              </strong>

                              <span>
                                {photoBatch
                                  ? formatBatchName(photoBatch.name)
                                  : `Batch ID: ${photo.batch_id}`}
                              </span>

                              <p>{photo.caption || "No caption"}</p>

                              <div className="gallery-admin-actions">
                                <button
                                  type="button"
                                  className="approve-btn"
                                  onClick={() =>
                                    reviewGalleryPhoto(photo.id, "approved")
                                  }
                                >
                                  <CheckCircle size={14} /> Approve
                                </button>

                                <button
                                  type="button"
                                  className="reject-btn"
                                  onClick={() =>
                                    reviewGalleryPhoto(photo.id, "rejected")
                                  }
                                >
                                  <XCircle size={14} /> Reject
                                </button>

                                <button
                                  type="button"
                                  className="reject-btn"
                                  onClick={() => deleteGalleryPhoto(photo)}
                                >
                                  <Trash2 size={14} /> Delete
                                </button>
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* MEMBER MANAGEMENT */}
                <div className="content-card" style={{ marginTop: 24 }}>
                  <h3>Member Management ({members.length})</h3>
                  <p>
                    Admin can edit member data and manage account access.
                  </p>

                  {members.map(person => (
                    <div className="pending-row" key={person.id}>
                      <div>
                        <strong>{person.full_name}</strong>
                        <span>
                          Batch: {formatBatchName(person.batch) || "Not specified"} ·
                          {" "}{person.passing_year || "N/A"}
                        </span>
                        <small>{person.phone}</small>
                      </div>

                      <div className="pending-actions">
                        <button
                          className="approve-btn"
                          onClick={() => setEditingMember({
                            ...person,
                            batch: formatBatchName(person.batch)
                          })}
                        >
                          <Edit size={14} /> Edit
                        </button>

                        {person.id !== session?.user?.id && (
                          <>
                            <button
                              className="reject-btn"
                              onClick={() => manageAuthAccount(person.id, "ban")}
                            >
                              <Ban size={14} /> Disable
                            </button>

                            <button
                              className="approve-btn"
                              onClick={() => manageAuthAccount(person.id, "unban")}
                            >
                              <RefreshCw size={14} /> Enable
                            </button>

                            <button
                              className="reject-btn"
                              onClick={() => manageAuthAccount(person.id, "delete")}
                            >
                              <Trash2 size={14} /> Delete Account
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}

                  {members.length === 0 && (
                    <p className="empty-state">No member profiles found.</p>
                  )}
                </div>

                {/* EDIT MEMBER */}
                {editingMember && (
                  <form
                    className="content-card profile-form"
                    onSubmit={adminUpdateMember}
                    style={{ marginTop: 24 }}
                  >
                    <h3>Edit Member</h3>

                    <div className="form-grid">
                      <FormField
                        label="Full Name"
                        value={editingMember.full_name}
                        onChange={v => setEditingMember(old => ({
                          ...old,
                          full_name: v
                        }))}
                        required
                      />

                      <FormField
                        label="Address"
                        value={editingMember.address}
                        onChange={v => setEditingMember(old => ({
                          ...old,
                          address: v
                        }))}
                      />

                      <FormField
                        label="Passing Year"
                        type="number"
                        value={editingMember.passing_year}
                        onChange={v => setEditingMember(old => ({
                          ...old,
                          passing_year: v
                        }))}
                      />

                      <div className="field">
                        <label>Batch</label>
                        <BatchSelect
                          value={editingMember.batch}
                          includeInactive
                          onChange={v => setEditingMember(old => ({
                            ...old,
                            batch: v
                          }))}
                          required
                        />
                      </div>

                      <FormField
                        label="Phone"
                        value={editingMember.phone}
                        onChange={v => setEditingMember(old => ({
                          ...old,
                          phone: v
                        }))}
                      />

                      <FormField
                        label="Blood Group"
                        value={editingMember.blood_group}
                        onChange={v => setEditingMember(old => ({
                          ...old,
                          blood_group: v
                        }))}
                      />

                      <div className="field full-field">
                        <label>Short Bio</label>
                        <textarea
                          value={editingMember.bio || ""}
                          onChange={e => setEditingMember(old => ({
                            ...old,
                            bio: e.target.value
                          }))}
                        />
                      </div>
                    </div>

                    <button className="btn-primary" disabled={authLoading}>
                      <Save size={17} /> Save Changes
                    </button>

                    <button
                      type="button"
                      className="btn-outline"
                      onClick={() => setEditingMember(null)}
                    >
                      Cancel
                    </button>
                  </form>
                )}

                {/* EVENT MANAGEMENT */}
                <div className="content-card" style={{ marginTop: 24 }}>
                  <h3>Manage Events</h3>

                  <form onSubmit={saveEvent}>
                    <label>Event Title</label>
                    <input
                      required
                      value={eventForm.title}
                      onChange={e => setEventForm({
                        ...eventForm,
                        title: e.target.value
                      })}
                    />

                    <label>Description</label>
                    <textarea
                      value={eventForm.description}
                      onChange={e => setEventForm({
                        ...eventForm,
                        description: e.target.value
                      })}
                    />

                    <label>Date</label>
                    <input
                      type="date"
                      value={eventForm.event_date}
                      onChange={e => setEventForm({
                        ...eventForm,
                        event_date: e.target.value
                      })}
                    />

                    <label>Location</label>
                    <input
                      value={eventForm.location}
                      onChange={e => setEventForm({
                        ...eventForm,
                        location: e.target.value
                      })}
                    />

                    <button className="btn-primary">
                      <Plus size={16} />
                      {editingEvent ? "Update Event" : "Add Event"}
                    </button>

                    {editingEvent && (
                      <button
                        type="button"
                        className="btn-outline"
                        onClick={() => {
                          setEditingEvent(null);
                          setEventForm(emptyEventForm);
                        }}
                      >
                        Cancel
                      </button>
                    )}
                  </form>

                  {events.map(event => (
                    <div className="pending-row" key={event.id}>
                      <div>
                        <strong>{event.title}</strong>
                        <span>{event.event_date || "Date not set"}</span>
                      </div>

                      <div className="pending-actions">
                        <button
                          className="approve-btn"
                          onClick={() => {
                            setEditingEvent(event.id);
                            setEventForm({
                              title: event.title || "",
                              description: event.description || "",
                              event_date: event.event_date || "",
                              location: event.location || ""
                            });
                          }}
                        >
                          Edit
                        </button>

                        <button
                          className="reject-btn"
                          onClick={() => deleteEvent(event.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* COMMITTEE MANAGEMENT */}
                <div className="content-card" style={{ marginTop: 24 }}>
                  <h3>Manage Committee</h3>

                  <form onSubmit={saveCommittee}>
                    <label>Name</label>
                    <input
                      required
                      value={committeeForm.name}
                      onChange={e => setCommitteeForm({
                        ...committeeForm,
                        name: e.target.value
                      })}
                    />

                    <label>Position</label>
                    <input
                      required
                      value={committeeForm.position}
                      onChange={e => setCommitteeForm({
                        ...committeeForm,
                        position: e.target.value
                      })}
                    />

                    <label>Batch</label>
                    <input
                      value={committeeForm.batch}
                      onChange={e => setCommitteeForm({
                        ...committeeForm,
                        batch: e.target.value
                      })}
                    />

                    <label>Photo URL</label>
                    <input
                      value={committeeForm.photo_url}
                      onChange={e => setCommitteeForm({
                        ...committeeForm,
                        photo_url: e.target.value
                      })}
                    />

                    <label>Display Order</label>
                    <input
                      type="number"
                      value={committeeForm.display_order}
                      onChange={e => setCommitteeForm({
                        ...committeeForm,
                        display_order: Number(e.target.value)
                      })}
                    />

                    <button className="btn-primary">
                      <Plus size={16} />
                      {editingCommittee
                        ? "Update"
                        : "Add Committee Member"}
                    </button>

                    {editingCommittee && (
                      <button
                        type="button"
                        className="btn-outline"
                        onClick={() => {
                          setEditingCommittee(null);
                          setCommitteeForm(emptyCommitteeForm);
                        }}
                      >
                        Cancel
                      </button>
                    )}
                  </form>

                  {committee.map(person => (
                    <div className="pending-row" key={person.id}>
                      <div>
                        <strong>{person.name}</strong>
                        <span>{person.position}</span>
                      </div>

                      <div className="pending-actions">
                        <button
                          className="approve-btn"
                          onClick={() => {
                            setEditingCommittee(person.id);
                            setCommitteeForm({
                              name: person.name || "",
                              position: person.position || "",
                              batch: person.batch || "",
                              photo_url: person.photo_url || "",
                              display_order: person.display_order || 0
                            });
                          }}
                        >
                          Edit
                        </button>

                        <button
                          className="reject-btn"
                          onClick={() => deleteCommittee(person.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        )}
      </main>

      {/* FOOTER */}
      <footer className="footer">
        <div className="container footer-content">
          <div>
            <h2>SMSA</h2>
            <p>Same Mind Student Association</p>
            <span>Connecting generations, building friendships.</span>
          </div>

          <p>© {new Date().getFullYear()} SMSA. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

function Feature({ icon, title, text }) {
  return (
    <div className="feature-card">
      <div className="feature-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}

function PageHeading({ label, title }) {
  return (
    <div className="page-heading">
      <span className="eyebrow">{label}</span>
      <h1>{title}</h1>
    </div>
  );
}

function FormField({
  label,
  value,
  onChange,
  type = "text",
  required = false
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <input
        type={type}
        value={value ?? ""}
        required={required}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  );
}
