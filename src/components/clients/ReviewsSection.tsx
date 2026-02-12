import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Star, Loader2, Trash2, MessageSquare, User } from "lucide-react";
import { useClientReviews, useCreateReview, useDeleteReview, type Review } from "@/hooks/useReviews";
import type { ClientContact } from "@/hooks/useClients";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

interface ReviewsSectionProps {
  clientId: string;
  contacts: ClientContact[];
}

export function ReviewsSection({ clientId, contacts }: ReviewsSectionProps) {
  const { data: reviews = [], isLoading } = useClientReviews(clientId);
  const createReview = useCreateReview();
  const deleteReview = useDeleteReview();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [contactId, setContactId] = useState<string>("none");

  const avgRating = reviews.length > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : 0;

  const handleSubmit = async () => {
    if (rating === 0) {
      toast({ title: "Please select a rating", variant: "destructive" });
      return;
    }

    // Parse @mentions from comment
    const mentionedContactId = contactId !== "none" ? contactId : null;

    try {
      await createReview.mutateAsync({
        client_id: clientId,
        contact_id: mentionedContactId,
        rating,
        comment: comment.trim() || null,
      });
      toast({ title: "Review added" });
      setRating(0);
      setComment("");
      setContactId("none");
      setShowForm(false);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleDelete = async (reviewId: string) => {
    try {
      await deleteReview.mutateAsync({ id: reviewId, clientId });
      toast({ title: "Review deleted" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Internal Reviews
            {reviews.length > 0 && (
              <Badge variant="secondary" className="text-xs gap-1">
                <Star className="h-3 w-3 fill-accent text-accent" />
                {avgRating.toFixed(1)} · {reviews.length}
              </Badge>
            )}
          </CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowForm(!showForm)}
          >
            {showForm ? "Cancel" : "Add Review"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add Review Form */}
        {showForm && (
          <div className="border rounded-lg p-4 space-y-3 bg-muted/20">
            {/* Star Rating */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Rating *</label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    onClick={() => setRating(star)}
                    className="transition-transform hover:scale-110"
                  >
                    <Star
                      className={`h-6 w-6 ${
                        star <= (hoverRating || rating)
                          ? "fill-accent text-accent"
                          : "text-muted-foreground/30"
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Contact Select (@ mention) */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                @ Contact (optional)
              </label>
              <Select value={contactId} onValueChange={setContactId}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Select a contact to review" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Company overall</SelectItem>
                  {contacts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.first_name} {c.last_name}{c.title ? ` · ${c.title}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Comment */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Comment</label>
              <Textarea
                placeholder="How was your experience working with them?"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="text-sm min-h-[60px]"
              />
            </div>

            <Button
              size="sm"
              className="bg-accent text-accent-foreground hover:bg-accent/90"
              onClick={handleSubmit}
              disabled={createReview.isPending || rating === 0}
            >
              {createReview.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
              Submit Review
            </Button>
          </div>
        )}

        {/* Reviews List */}
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : reviews.length === 0 && !showForm ? (
          <div className="text-center py-6 text-muted-foreground">
            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No reviews yet. Be the first to rate this company.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reviews.map((review) => (
              <ReviewCard
                key={review.id}
                review={review}
                onDelete={() => handleDelete(review.id)}
                isDeleting={deleteReview.isPending}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ReviewCard({
  review,
  onDelete,
  isDeleting,
}: {
  review: Review;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  const reviewerName = review.reviewer
    ? review.reviewer.display_name ||
      `${review.reviewer.first_name || ""} ${review.reviewer.last_name || ""}`.trim() ||
      "Unknown"
    : "Unknown";

  const contactName = review.contact
    ? `${review.contact.first_name || ""} ${review.contact.last_name || ""}`.trim()
    : null;

  const projectLabel = review.project
    ? review.project.project_number || review.project.name || "Project"
    : null;

  return (
    <div className="border rounded-lg p-3 space-y-2">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center">
            <User className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium leading-tight">{reviewerName}</p>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <div className="flex">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`h-3 w-3 ${
                      star <= review.rating
                        ? "fill-accent text-accent"
                        : "text-muted-foreground/30"
                    }`}
                  />
                ))}
              </div>
              {review.created_at && (
                <span>
                  · {formatDistanceToNow(new Date(review.created_at), { addSuffix: true })}
                </span>
              )}
            </div>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-destructive"
          onClick={onDelete}
          disabled={isDeleting}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>

      {/* Tags */}
      {(contactName || projectLabel) && (
        <div className="flex gap-1.5 flex-wrap">
          {contactName && (
            <Badge variant="secondary" className="text-xs">
              @{contactName}
            </Badge>
          )}
          {projectLabel && (
            <Badge variant="outline" className="text-xs">
              {projectLabel}
            </Badge>
          )}
        </div>
      )}

      {review.comment && (
        <p className="text-sm text-muted-foreground leading-relaxed">{review.comment}</p>
      )}
    </div>
  );
}
