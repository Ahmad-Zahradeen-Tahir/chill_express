"use client";
import { deleteOption, deleteOptionGroup } from "@/app/actions/menu-admin";
import { ConfirmButton } from "@/components/admin/forms";

export function DeleteGroup({ productId, groupId }: { productId: string; groupId: string }) {
  return <ConfirmButton variant="ghost" label="Delete group" confirmText="Delete this option group and all its options?" onConfirm={() => deleteOptionGroup(productId, groupId)} />;
}
export function DeleteOption({ groupId, optionId }: { groupId: string; optionId: string }) {
  return <ConfirmButton variant="ghost" label="Delete option" confirmText="Delete this option?" onConfirm={() => deleteOption(groupId, optionId)} />;
}
