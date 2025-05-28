import mongoose, { Document, Schema } from 'mongoose';

export interface IGroup extends Document {
  name: string;
  description?: string;
  createdAt: Date;
  createdBy: string;
  isActive: boolean;
}

const GroupSchema = new Schema<IGroup>({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  createdBy: {
    type: String,
    required: true,
    ref: 'User'
  },
  isActive: {
    type: Boolean,
    default: true
  }
});

export const Group = mongoose.model<IGroup>('Group', GroupSchema); 