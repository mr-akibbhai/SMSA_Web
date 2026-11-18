// Only interface messages on this allowlist may reach a visitor verbatim.
export const knownMessages = new Set([
 'Photo removed from the gallery. Image cleanup could not finish; please contact the administrator.','Please enter a whole number for display order.','Please sign in first.','Please choose a JPEG, PNG or WebP image.','Please select an image smaller than 10 MB.',
 'Please enter a valid phone number.','Your changes have been saved.','Content saved.','Member profile updated.',
 'Profile saved successfully.','Photo approved successfully.','Photo rejected successfully.','Photo deleted successfully.',
 'Photo submitted successfully. Waiting for Admin approval.','Password updated successfully.',
 'Passwords do not match.','Password must contain at least 6 characters.','Full Name and Batch are required.',
 'Please select an active Batch.','Please select a photo.','Please login first.',
 'You can upload photos only to your own active batch.','Maximum image size is 10 MB.',
 'This batch has reached its 100 approved-photo limit.','This batch gallery is not available yet.',
 'Admin login successful.','Member login successful.','Member registration successful.',
 'Account created. Check your email to confirm your account, then sign in and complete your profile.',
 'Password reset link sent. Check your email.','Only members can register.','Admin access required.',
 'Only Admin can create a new batch.','Enter the last two digits of the year (06–99).',
 'You cannot disable or delete your own Admin account.','You cannot delete your own Admin profile here.',
 'Event saved.','Event deleted.','Committee member saved.','Committee member deleted.',
 'Use a complete HTTPS community URL.','Your changes could not be saved. Please refresh and try again.',
 'Please refresh the member list and try again.','Please enter a batch name.',
 'This batch has linked content. Keep its name and update only its display order.',
 'Deactivate the batch before deletion.','Batch has linked content and cannot be deleted',
 'Access denied. This account is not authorised as an Admin.','This is an Admin account. Please use Admin Login.',
 'Additional website content is unavailable. Please retry; the database setup may be pending.'
]);
export function friendlyMessage(error){
 const value=typeof error==='string'?error:error?.message || '';
 if(!value)return '';
 if(knownMessages.has(value))return value;
 if(/invalid login credentials/i.test(value))return 'Email or password is incorrect.';
 if(/email.*not.*confirmed/i.test(value))return 'Please confirm your email before signing in.';
 if(/already.*registered/i.test(value))return 'This email is already registered. Please sign in.';
 if(/duplicate key|23505|already exists/i.test(value))return 'This item already exists. Choose a different name.';
 if(/row.level security|permission denied|unauthori[sz]ed|administrator access/i.test(value))return 'You do not have permission to perform this action.';
 if(/maximum 100/i.test(value))return 'This batch has reached its 100 approved-photo limit.';
 if(/bucket|schema cache|relation .*exist|function .*exist|configuration|Supabase configuration/i.test(value))return 'This feature is temporarily unavailable. Please contact the administrator.';
 if(/created successfully|activated successfully|deactivated successfully|Account action completed/i.test(value))return 'Your changes have been saved.';
 return 'Something went wrong. Please try again.';
}
export function logDiagnostic(error){
 if(import.meta.env.DEV){
  const value=String(error?.message || error || '').replace(/eyJ[\w.-]+/g,'[redacted]').replace(/sb_(?:secret|publishable)_[\w-]+/g,'[redacted]').replace(/https?:\/\/[^\s]+/g,'[URL]');
  console.error('SMSA operation failed:',{code:error?.code,message:value});
 }
}
