import { toast } from 'sonner';

type HandleErrProp = {
  setError?: any;
  onError?: any;
};

export const handleApiErr = (e: any, { setError, onError }: HandleErrProp) => {
  if (e?.errors && typeof setError === "function") {
    Object.keys(e.errors).forEach((key) => {
      setError(key, { message: e.errors[key] });
    });
  } else {
    const message = e?.message || "Something went wrong.";
    if (typeof onError === "function" && !onError(message, e.code)) {
      toast.error(message);
    } else {
      toast.error(message);
    }
  }
};